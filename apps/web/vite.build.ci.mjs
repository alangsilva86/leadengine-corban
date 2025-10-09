import { mergeConfig } from 'vite'
import baseConfig from './vite.config.js'

const manualChunks = (id) => {
  if (!id.includes('node_modules')) return
  if (id.includes('/react') || id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react'
  if (id.includes('react-router-dom')) return 'vendor-router'
  if (id.includes('@tanstack/react-query')) return 'vendor-query'
  if (id.includes('recharts')) return 'vendor-recharts'
  if (id.includes('@radix-ui')) return 'vendor-radix'
  if (id.includes('framer-motion')) return 'vendor-motion'
  if (id.includes('lucide-react')) return 'vendor-icons'
}

export default mergeConfig(baseConfig, {
  optimizeDeps: {
    entries: ['./index.html'],
    include: [],
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
    modulePreload: {
      polyfill: false,
    },
  },
})
