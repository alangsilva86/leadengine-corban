import { mergeConfig } from 'vite'
import baseConfig, { manualChunks } from './vite.config.js'

const shouldGenerateCssReport = process.env.GENERATE_CSS_REPORT === 'true'

export default mergeConfig(baseConfig, {
  optimizeDeps: {
    entries: ['./index.html'],
    include: [],
  },
  build: {
    target: 'es2020',
    sourcemap: shouldGenerateCssReport,
    minify: 'esbuild',
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
