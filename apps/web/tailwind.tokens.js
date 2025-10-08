/**
 * Design token groups exposed to Tailwind. Structure tokens semantically so that
 * documentation and components can reference intent-driven names instead of
 * presentation-specific aliases.
 */
export const colors = {
  /**
   * Surface layering tokens that describe the application canvas and its
   * various overlay states (cards, popovers, inbox, glass effects, etc.).
   */
  surface: {
    canvas: {
      light: '#f8fafc',
      dark: '#0f172a',
    },
    overlay: {
      quiet: {
        light: 'rgba(255, 255, 255, 0.78)',
        dark: 'rgba(124, 138, 163, 0.14)',
      },
      bold: {
        light: 'rgba(255, 255, 255, 0.92)',
        dark: 'rgba(124, 138, 163, 0.22)',
      },
      glass: {
        layer: {
          light: 'rgba(255, 255, 255, 0.85)',
          dark: 'rgba(148, 163, 184, 0.08)',
        },
        border: {
          light: 'rgba(15, 23, 42, 0.12)',
          dark: 'rgba(148, 163, 184, 0.25)',
        },
      },
      inbox: {
        quiet: {
          light: 'rgba(255, 255, 255, 0.72)',
          dark: 'rgba(15, 23, 42, 0.78)',
        },
        bold: {
          light: 'rgba(255, 255, 255, 0.88)',
          dark: 'rgba(15, 23, 42, 0.9)',
        },
      },
    },
  },
  /**
   * Content tokens define foreground colors for text and iconography across
   * neutral, muted and contextual areas like the inbox.
   */
  content: {
    primary: {
      light: '#0f172a',
      dark: '#f1f5f9',
    },
    muted: {
      light: '#475569',
      dark: '#94a3b8',
    },
    inbox: {
      primary: {
        light: '#0f172a',
        dark: 'rgba(241, 245, 249, 0.92)',
      },
      muted: {
        light: 'rgba(15, 23, 42, 0.6)',
        dark: 'rgba(241, 245, 249, 0.75)',
      },
    },
  },
  /**
   * Channel and status specific colors for messaging integrations.
   */
  status: {
    whatsapp: {
      light: '#25d366',
      dark: '#25d366',
    },
  },
  /**
   * Stroke tokens cover borders, dividers and other lines separating or
   * outlining surfaces.
   */
  stroke: {
    divider: {
      light: 'rgba(15, 23, 42, 0.08)',
      dark: 'rgba(124, 138, 163, 0.35)',
    },
    default: {
      light: 'rgba(15, 23, 42, 0.12)',
      dark: '#7c8aa3',
    },
    input: {
      light: 'rgba(15, 23, 42, 0.18)',
      dark: '#7c8aa3',
    },
    inbox: {
      light: 'rgba(15, 23, 42, 0.12)',
      dark: 'rgba(255, 255, 255, 0.12)',
    },
  },
  /**
   * Brand palettes for primary calls to action and supporting accent hues.
   */
  brand: {
    primary: {
      solid: {
        light: '#4f46e5',
        dark: '#6366f1',
      },
      onSolid: {
        light: '#eef2ff',
        dark: '#f8fafc',
      },
    },
    secondary: {
      surface: {
        light: 'rgba(79, 70, 229, 0.1)',
        dark: 'rgba(99, 102, 241, 0.12)',
      },
      onSurface: {
        light: '#0f172a',
        dark: '#f1f5f9',
      },
    },
    accent: {
      surface: {
        light: 'rgba(79, 70, 229, 0.16)',
        dark: 'rgba(99, 102, 241, 0.18)',
      },
      onSurface: {
        light: '#0f172a',
        dark: '#f1f5f9',
      },
    },
  },
  /**
   * Neutral support colors for subdued surfaces and corresponding typography.
   */
  support: {
    muted: {
      surface: {
        light: 'rgba(148, 163, 184, 0.16)',
        dark: 'rgba(148, 163, 184, 0.08)',
      },
      onSurface: {
        light: '#475569',
        dark: '#94a3b8',
      },
    },
  },
  /**
   * Feedback states used for success, warnings, errors and destructive actions.
   */
  feedback: {
    success: {
      solid: {
        light: '#16a34a',
        dark: '#22c55e',
      },
      onSoft: {
        light: '#14532d',
        dark: '#bbf7d0',
      },
      onStrong: {
        light: '#f0fdf4',
        dark: '#022c17',
      },
    },
    warning: {
      solid: {
        light: '#d97706',
        dark: '#facc15',
      },
      onSoft: {
        light: '#92400e',
        dark: '#fde68a',
      },
    },
    error: {
      solid: {
        light: '#dc2626',
        dark: '#ef4444',
      },
      onSoft: {
        light: '#991b1b',
        dark: '#fecaca',
      },
    },
    destructive: {
      solid: {
        light: '#dc2626',
        dark: '#ef4444',
      },
    },
  },
  /**
   * Interaction-specific strokes such as input outlines and focus rings.
   */
  interaction: {
    input: {
      light: 'rgba(15, 23, 42, 0.18)',
      dark: '#7c8aa3',
    },
    focus: {
      light: 'rgba(79, 70, 229, 0.55)',
      dark: '#6366f1',
    },
  },
  /**
   * Data visualization palettes for categorical charts and dashboards.
   */
  data: {
    visualization: {
      categorical: {
        '1': {
          light: '#4f46e5',
          dark: '#6366f1',
        },
        '2': {
          light: '#0ea5e9',
          dark: '#22d3ee',
        },
        '3': {
          light: '#f97316',
          dark: '#f97316',
        },
        '4': {
          light: '#16a34a',
          dark: '#22c55e',
        },
        '5': {
          light: '#facc15',
          dark: '#facc15',
        },
      },
    },
  },
  /**
   * Navigation-specific tokens tailored for sidebar shells and their accents.
   */
  navigation: {
    sidebar: {
      surface: {
        light: 'rgba(255, 255, 255, 0.85)',
        dark: 'rgba(15, 23, 42, 0.96)',
      },
      onSurface: {
        light: '#0f172a',
        dark: '#f1f5f9',
      },
      primary: {
        light: '#4f46e5',
        dark: '#6366f1',
      },
      onPrimary: {
        light: '#eef2ff',
        dark: '#f8fafc',
      },
      accent: {
        light: 'rgba(79, 70, 229, 0.1)',
        dark: 'rgba(148, 163, 184, 0.12)',
      },
      onAccent: {
        light: '#0f172a',
        dark: '#f1f5f9',
      },
      border: {
        light: 'rgba(15, 23, 42, 0.1)',
        dark: 'rgba(255, 255, 255, 0.12)',
      },
      focusRing: {
        light: 'rgba(79, 70, 229, 0.25)',
        dark: 'rgba(99, 102, 241, 0.4)',
      },
    },
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
}
