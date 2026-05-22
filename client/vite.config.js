import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: Vite serves the client on :5173 and proxies /api to the Express
// server on :8080. Prod: `vite build` emits to client/dist, which Express
// serves directly.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',
  },
})
