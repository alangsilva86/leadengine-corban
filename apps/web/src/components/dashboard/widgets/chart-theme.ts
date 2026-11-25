/** Estilos de gráfico ligados aos tokens do tema (claro/escuro). Status nunca usa cor de erro para volume neutro. */
export const chartAxis = {
  stroke: 'var(--color-border)',
  tick: { fill: 'var(--color-muted-foreground)', fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

export const chartGrid = {
  stroke: 'var(--color-border)',
  strokeDasharray: '3 3',
  vertical: false,
} as const;

export const chartTooltip = {
  contentStyle: {
    background: 'var(--color-popover)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-foreground)',
    fontSize: 12,
    boxShadow: 'var(--shadow-md)',
  },
  labelStyle: { color: 'var(--color-foreground)', fontWeight: 600 },
  cursor: { fill: 'var(--color-surface-hover)' },
} as const;

export const chartLegend = {
  iconType: 'circle' as const,
  iconSize: 8,
  wrapperStyle: { fontSize: 12, color: 'var(--color-muted-foreground)', paddingTop: 8 },
};
