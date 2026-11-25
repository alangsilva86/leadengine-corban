import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const shouldGenerateCssReport = process.env.GENERATE_CSS_REPORT === 'true'

/** Nome do pacote a partir do caminho do módulo (`…/node_modules/@scope/pkg/…` → `@scope/pkg`). */
const packageNameOf = (id) => {
  const index = id.lastIndexOf('/node_modules/')
  if (index < 0) return null
  const [scope, name] = id.slice(index + '/node_modules/'.length).split('/')
  return scope.startsWith('@') ? `${scope}/${name}` : scope
}

const REACT_CORE_PACKAGES = new Set(['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom', 'cookie', 'set-cookie-parser'])

/**
 * Agrupa só o que toda página usa. O resto (recharts, dnd, date-fns, day-picker, qrcode…) fica no chunk da
 * rota que o importa. Compara pelo nome do pacote: no pnpm o caminho inclui as peer deps
 * (`recharts@x_react-dom@y`), então testar `id.includes('react')` puxava quase tudo para o vendor inicial.
 */
export const manualChunks = (id) => {
  const pkg = packageNameOf(id)
  if (!pkg) return undefined
  if (REACT_CORE_PACKAGES.has(pkg)) return 'vendor-react'
  if (pkg.startsWith('@tanstack/')) return 'vendor-query'
  if (pkg === 'lucide-react') return 'vendor-icons'
  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  css: {
    postcss: {
      map: shouldGenerateCssReport ? { inline: false } : false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ticketz/contracts': path.resolve(__dirname, '../../packages/contracts/src'),
      '@ticketz/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@ticketz/shared/': path.resolve(__dirname, '../../packages/shared/src/'),
      '@ticketz/wa-contracts': path.resolve(__dirname, '../../packages/wa-contracts/src'),
      '@ticketz/wa-contracts/': path.resolve(__dirname, '../../packages/wa-contracts/src/'),
    },
  },
  optimizeDeps: {
    include: ['@tanstack/react-query', 'recharts'],
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
    sourcemap: shouldGenerateCssReport,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
})
