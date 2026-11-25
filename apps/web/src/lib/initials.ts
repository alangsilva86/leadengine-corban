type InitialsOptions = {
  /** Texto quando não há nome utilizável. */
  fallback?: string;
  /** Ignora palavras sem letras: um "nome" que é só telefone cai no fallback em vez de virar "+9". */
  lettersOnly?: boolean;
  /** Quantas letras usar quando o nome tem uma palavra só ("Ana" → "AN" ou "A"). */
  singleWordLetters?: 1 | 2;
};

/**
 * Iniciais para avatar (fonte única do web): primeira letra do primeiro e do último nome.
 * "Ana Paula Souza" → "AS".
 */
export const getInitials = (
  name: unknown,
  { fallback = '?', lettersOnly = false, singleWordLetters = 2 }: InitialsOptions = {}
): string => {
  if (typeof name !== 'string' || !name.trim()) return fallback;
  if (lettersOnly && !/\p{L}/u.test(name)) return fallback;

  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => (lettersOnly ? /\p{L}/u.test(part) : Boolean(part)));
  if (parts.length === 0) return fallback;

  if (parts.length === 1) {
    return parts[0]!.slice(0, singleWordLetters).toUpperCase() || fallback;
  }
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase() || fallback;
};

/** Pessoas no Inbox (contato, atendente): ignora "nomes" que são telefone; nome único vira uma letra. */
export const getPersonInitials = (name: unknown, fallback = '?'): string =>
  getInitials(name, { fallback, lettersOnly: true, singleWordLetters: 1 });
