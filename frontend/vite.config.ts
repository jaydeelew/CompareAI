import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'custom-server-urls',
      configureServer(server) {
        const printUrls = () => {
          const address = server.config.server.host || 'localhost'
          console.log('\n  \x1b[32m➜\x1b[0m  \x1b[1mLocal\x1b[0m:   \x1b[36mhttp://localhost/\x1b[0m')
        }
        
        server.httpServer?.once('listening', () => {
          setTimeout(() => {
            printUrls()
          }, 100)
        })
      }
    }
  ],
  cacheDir: '/tmp/vite-cache',
  server: {
    allowedHosts: ['compareintel.com', 'frontend', 'localhost'],
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 443,
      protocol: 'wss',
    },
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    // Ensure assets are chunked properly with hashes
    rollupOptions: {
      output: {
        // Ensure JS files have content hashes
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
    // Generate manifest for asset tracking (optional but useful for debugging)
    manifest: true,
  },
})
