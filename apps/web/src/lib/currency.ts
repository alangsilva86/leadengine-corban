/** Valores em reais (fonte única do web). */

const brlWhole = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const brlWithCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "R$ 12.000" (ou "R$ 1.234,56" com `cents`). Sempre devolve texto, inclusive para zero. */
export const formatCurrencyBRL = (value: number, { cents = false }: { cents?: boolean } = {}): string =>
  (cents ? brlWithCents : brlWhole).format(value);

/** Rótulo de valor potencial: "R$ 12.000", ou `null` quando não há valor (vazio, inválido ou zero). */
export const formatBRL = (value: number | null | undefined): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
    return null;
  }
  return brlWhole.format(value);
};
