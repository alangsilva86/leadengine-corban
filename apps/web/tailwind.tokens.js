/**
 * Semantic color tokens exposed to Tailwind. Each token stores fallback values
 * for the default (light) palette and the dark palette so that CSS variables
 * always have a single source of truth.
 */
export const surface = {
  surface: {
    default: 'rgba(255, 255, 255, 0.78)',
    dark: 'rgba(124, 138, 163, 0.14)',
  },
  'surface-strong': {
    default: 'rgba(255, 255, 255, 0.92)',
    dark: 'rgba(124, 138, 163, 0.22)',
  },
  'surface-contrast': {
    default: 'rgba(15, 23, 42, 0.12)',
    dark: 'rgba(255, 255, 255, 0.15)',
  },
  'surface-shell': {
    default: '#f8fafc',
    dark: '#020617',
  },
  'surface-shell-muted': {
    default: 'rgba(248, 250, 252, 0.86)',
    dark: 'rgba(2, 6, 23, 0.85)',
  },
  'surface-shell-subtle': {
    default: 'rgba(241, 245, 249, 0.72)',
    dark: 'rgba(2, 6, 23, 0.65)',
  },
  'surface-toolbar': {
    default: 'rgba(248, 250, 252, 0.9)',
    dark: 'rgba(15, 23, 42, 0.85)',
  },
  'surface-toolbar-muted': {
    default: 'rgba(248, 250, 252, 0.78)',
    dark: 'rgba(15, 23, 42, 0.6)',
  },
  'surface-glass': {
    default: 'rgba(255, 255, 255, 0.85)',
    dark: 'rgba(148, 163, 184, 0.08)',
  },
  'surface-glass-border': {
    default: 'rgba(15, 23, 42, 0.12)',
    dark: 'rgba(148, 163, 184, 0.25)',
  },
  'surface-overlay-quiet': {
    default: 'rgba(255, 255, 255, 0.78)',
    dark: 'rgba(124, 138, 163, 0.14)',
  },
  'surface-overlay-strong': {
    default: 'rgba(255, 255, 255, 0.92)',
    dark: 'rgba(124, 138, 163, 0.22)',
  },
  'surface-overlay-glass': {
    default: 'rgba(255, 255, 255, 0.85)',
    dark: 'rgba(148, 163, 184, 0.08)',
  },
  'surface-overlay-glass-border': {
    default: 'rgba(15, 23, 42, 0.12)',
    dark: 'rgba(148, 163, 184, 0.25)',
  },
  'surface-overlay-inbox-quiet': {
    default: 'rgba(255, 255, 255, 0.72)',
    dark: 'rgba(15, 23, 42, 0.78)',
  },
  'surface-overlay-inbox-bold': {
    default: 'rgba(255, 255, 255, 0.88)',
    dark: 'rgba(15, 23, 42, 0.9)',
  },
  'inbox-surface': {
    default: 'rgba(255, 255, 255, 0.72)',
    dark: 'rgba(15, 23, 42, 0.78)',
  },
  'inbox-surface-strong': {
    default: 'rgba(255, 255, 255, 0.88)',
    dark: 'rgba(15, 23, 42, 0.9)',
  },
  'inbox-border': {
    default: 'rgba(15, 23, 42, 0.12)',
    dark: 'rgba(255, 255, 255, 0.12)',
  },
  background: {
    default: '#f8fafc',
    dark: '#0f172a',
  },
  border: {
    default: 'rgba(15, 23, 42, 0.12)',
    dark: '#7c8aa3',
  },
  'border-shell': {
    default: 'rgba(15, 23, 42, 0.14)',
    dark: 'rgba(148, 163, 184, 0.32)',
  },
  divider: {
    default: 'rgba(15, 23, 42, 0.08)',
    dark: 'rgba(124, 138, 163, 0.35)',
  },
  input: {
    default: 'rgba(15, 23, 42, 0.18)',
    dark: '#7c8aa3',
  },
  sidebar: {
    default: 'rgba(255, 255, 255, 0.85)',
    dark: 'rgba(15, 23, 42, 0.96)',
  },
  'sidebar-border': {
    default: 'rgba(15, 23, 42, 0.1)',
    dark: 'rgba(255, 255, 255, 0.12)',
  },
}

export const foreground = {
  foreground: {
    default: '#0f172a',
    dark: '#f1f5f9',
  },
  'foreground-muted': {
    default: '#475569',
    dark: '#94a3b8',
  },
  'inbox-foreground': {
    default: '#0f172a',
    dark: 'rgba(241, 245, 249, 0.92)',
  },
  'inbox-foreground-muted': {
    default: 'rgba(15, 23, 42, 0.6)',
    dark: 'rgba(241, 245, 249, 0.75)',
  },
  'text-shell-muted': {
    default: 'rgba(15, 23, 42, 0.65)',
    dark: 'rgba(148, 163, 184, 0.78)',
  },
  'sidebar-foreground': {
    default: '#0f172a',
    dark: '#f1f5f9',
  },
}

export const accent = {
  accent: {
    default: 'rgba(79, 70, 229, 0.16)',
    dark: 'rgba(99, 102, 241, 0.18)',
  },
  'accent-foreground': {
    default: '#0f172a',
    dark: '#f1f5f9',
  },
  primary: {
    default: '#4f46e5',
    dark: '#6366f1',
  },
  'primary-foreground': {
    default: '#eef2ff',
    dark: '#f8fafc',
  },
  'primary-soft': {
    default: 'rgba(79, 70, 229, 0.14)',
    dark: 'rgba(99, 102, 241, 0.2)',
  },
  'primary-soft-border': {
    default: 'rgba(79, 70, 229, 0.38)',
    dark: 'rgba(99, 102, 241, 0.45)',
  },
  'inbox-primary': {
    default: '#10b981',
    dark: '#34d399',
  },
  'inbox-primary-foreground': {
    default: '#022c22',
    dark: '#022c22',
  },
  secondary: {
    default: 'rgba(79, 70, 229, 0.1)',
    dark: 'rgba(99, 102, 241, 0.12)',
  },
  'secondary-foreground': {
    default: '#0f172a',
    dark: '#f1f5f9',
  },
  muted: {
    default: 'rgba(148, 163, 184, 0.16)',
    dark: 'rgba(148, 163, 184, 0.08)',
  },
  'muted-foreground': {
    default: '#475569',
    dark: '#94a3b8',
  },
  ring: {
    default: 'rgba(79, 70, 229, 0.55)',
    dark: '#6366f1',
  },
  'ring-shell': {
    default: 'rgba(15, 23, 42, 0.16)',
    dark: 'rgba(255, 255, 255, 0.08)',
  },
  destructive: {
    default: '#dc2626',
    dark: '#ef4444',
  },
  'chart-1': {
    default: '#4f46e5',
    dark: '#6366f1',
  },
  'chart-2': {
    default: '#0ea5e9',
    dark: '#22d3ee',
  },
  'chart-3': {
    default: '#f97316',
    dark: '#f97316',
  },
  'chart-4': {
    default: '#16a34a',
    dark: '#22c55e',
  },
  'chart-5': {
    default: '#facc15',
    dark: '#facc15',
  },
  'sidebar-primary': {
    default: '#4f46e5',
    dark: '#6366f1',
  },
  'sidebar-primary-foreground': {
    default: '#eef2ff',
    dark: '#f8fafc',
  },
  'sidebar-accent': {
    default: 'rgba(79, 70, 229, 0.1)',
    dark: 'rgba(148, 163, 184, 0.12)',
  },
  'sidebar-accent-foreground': {
    default: '#0f172a',
    dark: '#f1f5f9',
  },
  'sidebar-ring': {
    default: 'rgba(79, 70, 229, 0.25)',
    dark: 'rgba(99, 102, 241, 0.4)',
  },
}

export const status = {
  'status-whatsapp': {
    default: '#25d366',
    dark: '#25d366',
  },
  'status-whatsapp-surface': {
    default: 'rgba(37, 211, 102, 0.18)',
    dark: 'rgba(37, 211, 102, 0.14)',
  },
  'status-whatsapp-border': {
    default: 'rgba(37, 211, 102, 0.3)',
    dark: 'rgba(37, 211, 102, 0.38)',
  },
  'status-whatsapp-foreground': {
    default: '#14532d',
    dark: '#bbf7d0',
  },
  success: {
    default: '#16a34a',
    dark: '#22c55e',
  },
  'success-soft': {
    default: '#dcfce7',
    dark: 'rgba(34, 197, 94, 0.18)',
  },
  'success-soft-border': {
    default: '#86efac',
    dark: 'rgba(34, 197, 94, 0.32)',
  },
  'success-strong': {
    default: '#14532d',
    dark: '#bbf7d0',
  },
  'success-soft-foreground': {
    default: '#14532d',
    dark: '#bbf7d0',
  },
  'success-strong-foreground': {
    default: '#f0fdf4',
    dark: '#022c17',
  },
  warning: {
    default: '#d97706',
    dark: '#facc15',
  },
  'warning-soft': {
    default: '#fef3c7',
    dark: 'rgba(250, 204, 21, 0.18)',
  },
  'warning-soft-border': {
    default: '#fcd34d',
    dark: 'rgba(250, 204, 21, 0.32)',
  },
  'warning-strong': {
    default: '#92400e',
    dark: '#fde68a',
  },
  'warning-soft-foreground': {
    default: '#92400e',
    dark: '#fde68a',
  },
  error: {
    default: '#dc2626',
    dark: '#ef4444',
  },
  'error-soft-foreground': {
    default: '#991b1b',
    dark: '#fecaca',
  },
  'status-error': {
    default: '#dc2626',
    dark: '#ef4444',
  },
  'status-error-surface': {
    default: 'rgba(220, 38, 38, 0.16)',
    dark: 'rgba(239, 68, 68, 0.15)',
  },
  'status-error-border': {
    default: 'rgba(220, 38, 38, 0.35)',
    dark: 'rgba(239, 68, 68, 0.4)',
  },
  'status-error-foreground': {
    default: '#991b1b',
    dark: '#fecaca',
  },
}

export const tone = {
  'tone-info-surface': {
    default: 'rgba(79, 70, 229, 0.18)',
    dark: 'rgba(99, 102, 241, 0.18)',
  },
  'tone-info-border': {
    default: 'rgba(79, 70, 229, 0.42)',
    dark: 'rgba(99, 102, 241, 0.45)',
  },
  'tone-info-foreground': {
    default: '#bbc5fc',
    dark: '#cad3fd',
  },
}

export const spacing = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
}

export const radii = {
  DEFAULT: '0.75rem',
  sm: '0.5rem',
  md: '0.625rem',
  lg: '0.75rem',
  xl: '1rem',
}

export const shadows = {
  xs: '0 1px 0 0 color-mix(in srgb, var(--color-border) 65%, transparent)',
  sm: [
    '0 1px 2px 0 color-mix(in srgb, var(--color-border) 45%, transparent)',
    '0 1px 3px -1px color-mix(in srgb, var(--color-border) 40%, transparent)',
  ].join(', '),
  md: '0 6px 16px -2px color-mix(in srgb, var(--color-border) 35%, transparent)',
  lg: '0 12px 32px -12px color-mix(in srgb, var(--color-border) 32%, transparent)',
  xl: '0 24px 60px color-mix(in srgb, var(--color-border) 25%, transparent)',
  'focus-primary': [
    'var(--shadow-lg)',
    '0 0 0 1px var(--color-primary-soft-border, rgba(79, 70, 229, 0.38))',
  ].join(', '),
  'brand-ring': [
    'var(--shadow-lg, 0 12px 32px -12px color-mix(in srgb, var(--color-border) 32%, transparent))',
    '0 0 0 1px var(--tone-info-border, rgba(79, 70, 229, 0.42))',
  ].join(', '),
}
