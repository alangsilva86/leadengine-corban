import type { Config } from 'tailwindcss'
import { colors, spacing, radii, shadows } from './tailwind.tokens.js'

const config = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    colors,
    extend: {
      spacing,
      borderRadius: radii,
      boxShadow: shadows,
      colors: {
        'surface-overlay-quiet': 'var(--surface-overlay-quiet)',
        'surface-overlay-strong': 'var(--surface-overlay-strong)',
        'surface-overlay-glass': 'var(--surface-overlay-glass)',
        'surface-overlay-glass-border': 'var(--surface-overlay-glass-border)',
        'status-whatsapp': 'var(--status-whatsapp)',
      },
    },
  },
  plugins: [],
} satisfies Config

export default config
