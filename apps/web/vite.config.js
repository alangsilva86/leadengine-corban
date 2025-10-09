import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  optimizeDeps: {
    include: ['@tanstack/react-query', '@tanstack/query-core', 'recharts'],
  },
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/react') || id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('react-router-dom')) return 'vendor-router'
          if (id.includes('@tanstack/react-query')) return 'vendor-query'
          if (id.includes('recharts')) return 'vendor-recharts'
          if (id.includes('@radix-ui')) return 'vendor-radix'
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('lucide-react')) return 'vendor-icons'
        },
      },
    },
  },
})
