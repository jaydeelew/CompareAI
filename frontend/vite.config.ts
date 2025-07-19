import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['compareintel.com'],
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
