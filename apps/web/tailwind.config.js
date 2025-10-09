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
  'success-soft': 'var(--color-success-soft)',
  'success-soft-border': 'var(--color-success-soft-border)',
  'success-strong': 'var(--color-success-strong)',
  'success-soft-foreground': 'var(--color-success-soft-foreground)',
  'success-strong-foreground': 'var(--color-success-strong-foreground)',
  warning: 'var(--color-warning)',
  'warning-soft': 'var(--color-warning-soft)',
  'warning-soft-border': 'var(--color-warning-soft-border)',
  'warning-strong': 'var(--color-warning-strong)',
  'warning-soft-foreground': 'var(--color-warning-soft-foreground)',
  error: 'var(--color-error)',
  'error-soft-foreground': 'var(--color-error-soft-foreground)',
  surface: 'var(--color-surface)',
  'surface-strong': 'var(--color-surface-strong)',
  'surface-shell': 'var(--color-surface-shell)',
  'surface-contrast': 'var(--color-surface-contrast)',
  'surface-glass': 'var(--color-surface-glass)',
  'surface-glass-border': 'var(--color-surface-glass-border)',
  'surface-overlay-quiet': 'var(--surface-overlay-quiet)',
  'surface-overlay-strong': 'var(--surface-overlay-strong)',
  'surface-overlay-glass': 'var(--surface-overlay-glass)',
  'surface-overlay-glass-border': 'var(--surface-overlay-glass-border)',
  'surface-shell-muted': 'var(--surface-shell-muted)',
  'surface-shell-subtle': 'var(--surface-shell-subtle)',
  'surface-toolbar': 'var(--surface-toolbar)',
  'surface-toolbar-muted': 'var(--surface-toolbar-muted)',
  'status-whatsapp': 'var(--status-whatsapp)',
  'status-whatsapp-surface': 'var(--status-whatsapp-surface)',
  'status-whatsapp-border': 'var(--status-whatsapp-border)',
  'status-whatsapp-foreground': 'var(--status-whatsapp-foreground)',
  'status-error': 'var(--status-error)',
  'status-error-surface': 'var(--status-error-surface)',
  'status-error-border': 'var(--status-error-border)',
  'status-error-foreground': 'var(--status-error-foreground)',
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
  'ring-shell': 'var(--ring-shell)',
  'text-shell-muted': 'var(--text-shell-muted)',
  'border-shell': 'var(--border-shell)',
}

const pascalCase = (value) =>
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
    {},
  )

  addUtilities(utilities)
})

/** @type {import('tailwindcss').Config} */
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
}

export default config
