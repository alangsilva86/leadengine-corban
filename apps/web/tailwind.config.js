import { colors, spacing, radii, shadows } from './tailwind.tokens.js'

/** @type {import('tailwindcss').Config} */
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
}

export default config
