import { mergeConfig } from 'vite'
import baseConfig from './vite.config.js'

const manualChunks = (id) => {
  if (!id.includes('node_modules')) return
  if (id.includes('react')) return 'vendor-react'
  if (id.includes('@tanstack')) return 'vendor-query'
  if (id.includes('recharts')) return 'vendor-recharts'
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
