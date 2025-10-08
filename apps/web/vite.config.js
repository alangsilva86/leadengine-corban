import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

process.env.TAILWIND_CONFIG = path.resolve(__dirname, './tailwind.config.js')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['@tanstack/react-query', '@tanstack/query-core', 'recharts'],
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/react@') || id.includes('/react/')) {
            return 'vendor-react-core';
          }

          if (id.includes('react-dom') || id.includes('scheduler')) {
            return 'vendor-react-dom';
          }

          if (id.includes('react-router-dom')) {
            return 'vendor-react-router';
          }

          if (id.includes('@tanstack/react-query')) {
            return 'vendor-react-query';
          }

          if (id.includes('recharts')) {
            return 'vendor-recharts';
          }

          if (id.includes('@radix-ui')) {
            // Agrupar Radix junto com React evita ciclos entre chunks
            return 'vendor-react-core';
          }

          if (id.includes('framer-motion')) {
            return 'vendor-framer-motion';
          }

          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }

          return undefined;
        },
      },
    },
  },
})
