/**
 * Tom semântico → classes do design system (fonte única do web; nunca cores da paleta).
 * Ver `docs/design-system/tokens.md`.
 */

export type Tone = 'neutral' | 'info' | 'primary' | 'success' | 'warning' | 'danger' | 'whatsapp';

/** Ponto/indicador sólido. `muted` e `pending` são apelidos de `neutral`. */
export const TONE_DOT_CLASSES: Record<Tone | 'muted' | 'pending', string> = {
  neutral: 'bg-subtle-foreground',
  muted: 'bg-subtle-foreground',
  pending: 'bg-subtle-foreground',
  info: 'bg-info',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  whatsapp: 'bg-whatsapp',
};

/** Fundo + texto "soft" (chips, pílulas, badges de status). */
export const TONE_SOFT_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-muted-foreground',
  info: 'bg-info-soft text-info-soft-foreground',
  primary: 'bg-primary-soft text-primary-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  danger: 'bg-danger-soft text-danger-soft-foreground',
  whatsapp: 'bg-whatsapp-soft text-whatsapp-soft-foreground',
};
