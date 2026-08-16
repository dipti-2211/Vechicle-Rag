import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  server: {
    port: 5173,
    strictPort: true,   // fail loudly if 5173 is taken rather than silently switching
    proxy: {
      // All /api/* calls are forwarded to FastAPI — this eliminates CORS entirely
      // because the browser sees a same-origin request (localhost:5173 → localhost:5173).
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Surface proxy errors in the Vite console so they’re not silently swallowed
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.error('[vite-proxy] Backend unreachable:', err.message)
            if (res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                error: 'Backend unavailable',
                detail: 'The FastAPI backend is not running on port 8000.',
              }))
            }
          })
        },
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
