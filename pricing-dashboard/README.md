# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Deploy & Production

This project is ready to be containerized. The repository includes a `Dockerfile` (multi-stage) and a `docker-compose.yml` for easy deployment.

Quick local production build and run:

```bash
cd pricing-dashboard
npm ci
npm run build
npm run start:prod
```

Build and run with Docker:

```bash
# build image
docker build -t pricing-dashboard:latest .

# run container (map host port 80 to container 3001)
docker run -p 80:3001 \
  -e GEMINI_API_KEY="$GEMINI_API_KEY" \
  -e METRICS_FILE=/app/metrics.jsonl \
  --restart unless-stopped \
  pricing-dashboard:latest
```

Or use `docker-compose up -d --build` (the compose file maps host port 80 to service port 3001).

Important env vars for production (set securely):
- `GEMINI_API_KEY` (required)
- `METRICS_FILE` (optional)
- `METRICS_SECRET` (optional, recommended to protect `/api/metrics`)

If you want a public HTTPS link, deploy the Docker image to a platform such as Cloud Run, Render, Fly, Railway or a VPS behind a reverse proxy (Nginx) with TLS. I can help automate a deploy to any of those platforms if you tell me which one to use and provide appropriate credentials or access.

CI/CD workflows
----------------
I added two optional GitHub Actions workflows in `.github/workflows/`:

- `deploy-cloudrun.yml`: builds the image, pushes to `gcr.io/${GCP_PROJECT}` and deploys to Cloud Run.
  - Required repository secrets:
    - `GCP_SA_KEY` — the GCP service account key JSON (as a single-line or multiline secret).
    - `GCP_PROJECT` — the GCP project id.
    - `CLOUD_RUN_SERVICE` — target Cloud Run service name.
    - `CLOUD_RUN_REGION` — e.g. `us-central1`.

- `deploy-render.yml`: triggers a manual deploy on Render by calling the Render API.
  - Required repository secrets:
    - `RENDER_API_KEY` — Render API key with deploy permissions.
    - `RENDER_SERVICE_ID` — the service id of the Render service (you get it from Render dashboard).

How to use the workflows
-------------------------
1. Commit and push these changes to `main` (or open the Actions tab and run the workflow manually via `Workflow -> Run workflow`).
2. For Cloud Run: add the secrets in the GitHub repo `Settings → Secrets` and then run the `Deploy to Cloud Run` workflow. The job prints the service URL.
   - Tip: To protect `/metrics`, set `METRICS_SECRET` as an environment variable in your Cloud Run service. Example using `gcloud`:

```bash
gcloud run services update $CLOUD_RUN_SERVICE \
  --region $CLOUD_RUN_REGION \
  --update-env-vars METRICS_SECRET="your-strong-secret" \
  --project $GCP_PROJECT
```

Or set the env var in the Cloud Run console (Service → Variables & Secrets).
3. For Render: connect your repo to Render and create the service, then add `RENDER_API_KEY` and `RENDER_SERVICE_ID` to the repo secrets and run the `Trigger Render deploy` workflow. The workflow triggers a deploy and polls until the deploy is live, then returns the service URL.

If you want, puedo ejecutar el workflow por ti (si me das los secrets aquí o los configuro en GitHub). Alternativamente, puedo guiarte para pegarlos y lanzar la acción desde tu GitHub.
