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
    },
  },
  plugins: [],
} satisfies Config

export default config
