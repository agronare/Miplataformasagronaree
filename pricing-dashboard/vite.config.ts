import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Calculate a sensible `base` for GitHub Pages deployments when the
// `DEPLOY_TO_GHPAGES` env var is set by CI. Otherwise default to '/'.
const repo = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '';
const base = process.env.DEPLOY_TO_GHPAGES === 'true' && repo ? `/${repo}/` : '/';

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
