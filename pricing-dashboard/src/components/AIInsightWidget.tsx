import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

type SummaryItem = {
  categoria: string;
  linea: string;
  num_prod: number;
  prom_menudeo: number;
  prom_may3: number;
  desc_max: number;
  min_cant_may3?: number | null;
};

const GEMINI_PROXY = import.meta.env.VITE_GEMINI_PROXY_URL || '/api/gemini';

async function callGeminiProxy(prompt: string): Promise<string> {
  const resp = await fetch(GEMINI_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body?.error || 'Proxy request failed');
  }
  const data = await resp.json();
  return data.text || 'No response';
}

type Props = { summaryData: SummaryItem[] };

export default function AIInsightWidget({ summaryData }: Props) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateInsight = async () => {
    setLoading(true);
    try {
      const topOpportunities = summaryData
        .filter((item) => item.desc_max > 15)
        .slice(0, 5)
        .map((item) => `${item.categoria} (${item.linea}): ${item.desc_max.toFixed(1)}% descuento`);

      const prompt = `Actúa como un analista experto en precios de retail y mayoreo. Top oportunidades: ${JSON.stringify(
        topOpportunities,
      )}. Genera un breve análisis estratégico en español (máx 3 párrafos cortos). Usa emojis.`;

      const text = await callGeminiProxy(prompt);
      setInsight(text);
    } catch (err) {
      console.error(err);
      setInsight('Ocurrió un error al generar el análisis.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl shadow-sm border border-indigo-100 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Sparkles className="h-5 w-5 text-indigo-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Análisis Estratégico AI</h3>
      </div>

      {!insight && !loading && (
        <div className="text-center py-6">
          <p className="text-sm text-slate-600 mb-4">Descubre oportunidades ocultas en tus márgenes de descuento con un clic.</p>
          <button onClick={generateInsight} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
            <Sparkles className="h-4 w-4 inline-block mr-2" /> Generar Análisis Inteligente
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-8 text-indigo-600">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p className="text-sm font-medium">Analizando patrones de precios...</p>
        </div>
      )}

      {insight && (
        <div>
          <div className="prose prose-sm max-w-none text-slate-700 bg-white/50 p-4 rounded-lg border border-indigo-50/50">
            <p className="whitespace-pre-line">{insight}</p>
          </div>
          <button onClick={() => setInsight(null)} className="mt-4 text-xs text-indigo-600 hover:text-indigo-800 font-medium underline">
            Generar nuevo análisis
          </button>
        </div>
      )}
    </div>
  );
}
