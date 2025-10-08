import { mergeConfig } from 'vite'
import baseConfig from './vite.config.js'

export default mergeConfig(baseConfig, {
  build: {
    target: 'es2020',
    sourcemap: false,
    minify: false,
    modulePreload: {
      polyfill: false,
    },
  },
})
