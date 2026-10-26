import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The browser only ever talks to /api/*. Vite forwards those calls to the
// Express server on port 3001, so the API key never has to reach the client.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
