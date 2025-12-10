const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
require('dotenv').config();

// Prometheus client
let promClient = null;
try {
  promClient = require('prom-client');
} catch (e) {
  console.warn('[metrics] prom-client not installed; Prometheus metrics will be disabled. Run `npm install prom-client` to enable.');
}

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// Compression for static assets
app.use(compression());

// Serve client assets if present (production build)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback: serve index.html for unknown GET routes
  // SPA fallback: serve index.html for client-side routes (avoid route patterns)
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    const p = req.path || '';
    if (p.startsWith('/api') || p === '/metrics' || p === '/api/metrics') return next();
    // If the requested file exists under dist, let static middleware handle it
    const filePath = path.join(distPath, req.path === '/' ? '/index.html' : req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return next();
    return res.sendFile(path.join(distPath, 'index.html'));
  });
}

// --- Simple in-memory metrics storage (circular buffer) + file persistence ---
const MAX_METRICS = 200;
const metrics = [];
const METRICS_FILE = process.env.METRICS_FILE || 'metrics.jsonl';

// Prometheus metrics (initialized if prom-client present)
let promRegistry = null;
let promUpstreamHist = null;
let promTotalHist = null;
let promReqCounter = null;
let promErrCounter = null;
if (promClient) {
  promRegistry = new promClient.Registry();
  promUpstreamHist = new promClient.Histogram({
    name: 'proxy_upstream_duration_ms',
    help: 'Upstream request duration in milliseconds',
    buckets: [50, 100, 250, 500, 1000, 2000, 5000],
    registers: [promRegistry],
    labelNames: ['path', 'status']
  });
  promTotalHist = new promClient.Histogram({
    name: 'proxy_total_duration_ms',
    help: 'Total proxy request duration in milliseconds',
    buckets: [50, 100, 250, 500, 1000, 2000, 5000],
    registers: [promRegistry],
    labelNames: ['path']
  });
  promReqCounter = new promClient.Counter({
    name: 'proxy_requests_total',
    help: 'Total number of proxy requests',
    registers: [promRegistry],
    labelNames: ['path']
  });
  promErrCounter = new promClient.Counter({
    name: 'proxy_errors_total',
    help: 'Total number of proxy errors',
    registers: [promRegistry],
    labelNames: ['path', 'status']
  });

  // Default metrics collection (process_*)
  promClient.collectDefaultMetrics({ register: promRegistry });
}

function pushMetric(m) {
  metrics.push(m);
  if (metrics.length > MAX_METRICS) metrics.shift();

  // append to file (JSON Lines) asynchronously
  try {
    fs.appendFile(METRICS_FILE, JSON.stringify(m) + '\n', (err) => {
      if (err) console.error('[metrics] Failed to write metric to file:', err.message || err);
    });
  } catch (e) {
    console.error('[metrics] Could not persist metric:', e?.message || e);
  }

  // update Prometheus metrics if enabled
  if (promClient) {
    try {
      promReqCounter.inc({ path: m.path }, 1);
      promUpstreamHist.observe({ path: m.path, status: String(m.upstreamStatus) }, m.upstreamDurationMs);
      promTotalHist.observe({ path: m.path }, m.totalDurationMs);
      if (m.upstreamStatus >= 400) promErrCounter.inc({ path: m.path, status: String(m.upstreamStatus) }, 1);
    } catch (e) {
      console.error('[metrics] Error updating Prometheus metrics:', e?.message || e);
    }
  }
}

// Middleware to add request id and start timing
app.use((req, res, next) => {
  // Use crypto.randomUUID if available, fallback to timestamp-based id
  let requestId = null;
  try {
    requestId = (require('crypto').randomUUID && require('crypto').randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  } catch (e) {
    requestId = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  }
  req.requestId = requestId;
  req._timings = { start: process.hrtime.bigint() };
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Expose metrics (only in non-production by default)
app.get('/api/metrics', (req, res) => {
  if (process.env.NODE_ENV === 'production' && req.query.secret !== process.env.METRICS_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json({ count: metrics.length, metrics });
});

// Prometheus exposition endpoint (unprotected by default so scrapers can pull)
app.get('/metrics', async (req, res) => {
  if (!promClient) {
    return res.status(501).send('# Prometheus metrics not enabled (prom-client missing)\n');
  }

  // Protect /metrics in production using METRICS_SECRET
  const secret = process.env.METRICS_SECRET;
  if (process.env.NODE_ENV === 'production' && secret) {
    const provided = (req.headers['x-metrics-secret'] || '') ||
      (req.headers['authorization'] && String(req.headers['authorization']).replace(/^Bearer\s+/i, '')) ||
      req.query.secret || '';
    if (!provided || provided !== secret) {
      return res.status(403).send('# Forbidden\n');
    }
  }

  try {
    res.set('Content-Type', promRegistry.contentType);
    const metricsText = await promRegistry.metrics();
    return res.send(metricsText);
  } catch (e) {
    console.error('[metrics] Failed to collect Prometheus metrics:', e?.message || e);
    return res.status(500).send('# Error collecting metrics\n');
  }
});

if (!process.env.GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY is not set. The /api/gemini endpoint will fail without it.');
}

app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid prompt' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server' });
    }

    const body = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    const urlBase = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';
    const url = `${urlBase}?key=${apiKey}`;

    // mark upstream start time
    req._timings.upstreamStart = process.hrtime.bigint();
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    req._timings.upstreamEnd = process.hrtime.bigint();

    // If upstream failed, try to capture JSON or text body for debugging
    if (!r.ok) {
      let details = null;
      try {
        const txt = await r.text();
        // Try to parse JSON but fallback to raw text
        try {
          details = JSON.parse(txt);
        } catch (e) {
          details = txt;
        }
      } catch (e) {
        details = `Could not read upstream response body: ${e?.message || String(e)}`;
      }

      // Log a concise error server-side without the api key
      const safeUrl = url.replace(/(\?|&)key=[^&]+/, '?key=[REDACTED]');
      console.error(`[proxy] Upstream error ${r.status} ${r.statusText} for ${safeUrl}`);
      console.error('[proxy] upstream details:', typeof details === 'string' ? details : JSON.stringify(details));

      // record metric
      const upstreamDurationMs = Number(req._timings.upstreamEnd - req._timings.upstreamStart) / 1e6;
      const totalDurationMs = Number(process.hrtime.bigint() - req._timings.start) / 1e6;
      pushMetric({
        id: req.requestId,
        path: req.path,
        promptLength: (prompt && prompt.length) || 0,
        upstreamStatus: r.status,
        upstreamDurationMs: Math.round(upstreamDurationMs * 100) / 100,
        totalDurationMs: Math.round(totalDurationMs * 100) / 100,
        timestamp: Date.now(),
      });

      return res.status(r.status).json({ error: 'Upstream error', status: r.status, statusText: r.statusText, details });
    }

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    // record success metric
    const upstreamDurationMs = Number(req._timings.upstreamEnd - req._timings.upstreamStart) / 1e6;
    const totalDurationMs = Number(process.hrtime.bigint() - req._timings.start) / 1e6;
    pushMetric({
      id: req.requestId,
      path: req.path,
      promptLength: (prompt && prompt.length) || 0,
      upstreamStatus: r.status,
      upstreamDurationMs: Math.round(upstreamDurationMs * 100) / 100,
      totalDurationMs: Math.round(totalDurationMs * 100) / 100,
      timestamp: Date.now(),
    });

    return res.json({ text });
  } catch (err) {
    // Be helpful in development but avoid leaking secrets
    console.error('[proxy] Unexpected error in /api/gemini:', err?.message || err);
    const payload = { error: 'Internal server error' };
    if (process.env.NODE_ENV !== 'production') {
      payload.details = err?.stack || err?.message || String(err);
    }
    return res.status(500).json(payload);
  }
});

app.listen(port, () => {
  console.log(`Server proxy listening on http://localhost:${port}`);
});
