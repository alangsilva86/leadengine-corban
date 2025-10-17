import { describe, expect, it } from 'vitest';

import { DEFAULT_STATUS, INBOX_STATUSES, STATUS_META } from '../statusMeta.js';

describe('STATUS_META', () => {
  it('expõe os labels e tones esperados para cada status', () => {
    expect(STATUS_META).toEqual({
      allocated: { label: 'Aguardando contato', tone: 'neutral' },
      contacted: { label: 'Em conversa', tone: 'info' },
      won: { label: 'Venda realizada', tone: 'success' },
      lost: { label: 'Sem interesse', tone: 'error' },
    });
  });

  it('mantém a lista de status sincronizada com o metadata', () => {
    expect(INBOX_STATUSES).toEqual(['allocated', 'contacted', 'won', 'lost']);
    expect(new Set(INBOX_STATUSES)).toEqual(new Set(Object.keys(STATUS_META)));
  });

  it('define um status padrão válido', () => {
    expect(STATUS_META).toHaveProperty(DEFAULT_STATUS);
  });
});
