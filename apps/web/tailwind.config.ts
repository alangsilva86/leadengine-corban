import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import { colors, spacing, radii, shadows } from './tailwind.tokens.js'

const semanticColorTokens = {
  background: 'var(--color-background)',
  foreground: 'var(--color-foreground)',
  'foreground-muted': 'var(--color-foreground-muted)',
  divider: 'var(--color-divider)',
  primary: 'var(--color-primary)',
  'primary-foreground': 'var(--color-primary-foreground)',
  success: 'var(--color-success)',
  'success-soft-foreground': 'var(--color-success-soft-foreground)',
  'success-strong-foreground': 'var(--color-success-strong-foreground)',
  warning: 'var(--color-warning)',
  'warning-soft-foreground': 'var(--color-warning-soft-foreground)',
  error: 'var(--color-error)',
  'error-soft-foreground': 'var(--color-error-soft-foreground)',
  surface: 'var(--color-surface)',
  'surface-strong': 'var(--color-surface-strong)',
  'surface-glass': 'var(--color-surface-glass)',
  'surface-glass-border': 'var(--color-surface-glass-border)',
  'surface-overlay-quiet': 'var(--surface-overlay-quiet)',
  'surface-overlay-strong': 'var(--surface-overlay-strong)',
  'surface-overlay-glass': 'var(--surface-overlay-glass)',
  'surface-overlay-glass-border': 'var(--surface-overlay-glass-border)',
  'status-whatsapp': 'var(--status-whatsapp)',
  'inbox-surface': 'var(--color-inbox-surface)',
  'inbox-surface-strong': 'var(--color-inbox-surface-strong)',
  'inbox-border': 'var(--color-inbox-border)',
  'inbox-foreground': 'var(--color-inbox-foreground)',
  'inbox-foreground-muted': 'var(--color-inbox-foreground-muted)',
  border: 'var(--color-border)',
  input: 'var(--color-input)',
  ring: 'var(--color-ring)',
  secondary: 'var(--color-secondary)',
  'secondary-foreground': 'var(--color-secondary-foreground)',
  muted: 'var(--color-muted)',
  'muted-foreground': 'var(--color-muted-foreground)',
  accent: 'var(--color-accent)',
  'accent-foreground': 'var(--color-accent-foreground)',
  destructive: 'var(--color-destructive)',
  'chart-1': 'var(--color-chart-1)',
  'chart-2': 'var(--color-chart-2)',
  'chart-3': 'var(--color-chart-3)',
  'chart-4': 'var(--color-chart-4)',
  'chart-5': 'var(--color-chart-5)',
  sidebar: 'var(--color-sidebar)',
  'sidebar-foreground': 'var(--color-sidebar-foreground)',
  'sidebar-primary': 'var(--color-sidebar-primary)',
  'sidebar-primary-foreground': 'var(--color-sidebar-primary-foreground)',
  'sidebar-accent': 'var(--color-sidebar-accent)',
  'sidebar-accent-foreground': 'var(--color-sidebar-accent-foreground)',
  'sidebar-border': 'var(--color-sidebar-border)',
  'sidebar-ring': 'var(--color-sidebar-ring)',
} as const

const pascalCase = (value: string) =>
  value
    .split(/[-_]/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('')

const semanticUtilitiesPlugin = plugin(({ addUtilities }) => {
  const utilities = Object.entries(semanticColorTokens).reduce(
    (acc, [token, cssVar]) => {
      const tokenName = pascalCase(token)

      acc[`.text${tokenName}`] = { color: cssVar }
      acc[`.border${tokenName}`] = { borderColor: cssVar }
      acc[`.bg${tokenName}`] = { backgroundColor: cssVar }
      acc[`.fill${tokenName}`] = { fill: cssVar }
      acc[`.stroke${tokenName}`] = { stroke: cssVar }

      return acc
    },
    {} as Record<string, Record<string, string>>,
  )

  addUtilities(utilities)
})

const config = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx,md,mdx}'],
  theme: {
    colors,
    extend: {
      spacing,
      borderRadius: radii,
      boxShadow: shadows,
      colors: {
        ...semanticColorTokens,
      },
    },
  },
  plugins: [semanticUtilitiesPlugin],
} satisfies Config

export default config
