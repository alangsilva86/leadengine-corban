import { describe, it, expect } from 'vitest';

import { buildWhereClause } from './messages';

describe('buildWhereClause', () => {
  it('includes tenantId and direction filters when provided', () => {
    const where = buildWhereClause('tenant-1', { chatId: null, direction: 'INBOUND' });
    expect(where).toEqual({ tenantId: 'tenant-1', direction: 'INBOUND' });
  });

  it('adds OR clause when chatId is provided', () => {
    const where = buildWhereClause(null, { chatId: '123', direction: null });
    expect(where.OR).toEqual([
      { metadata: { path: ['chatId'], string_contains: '123' } },
      { metadata: { path: ['remoteJid'], string_contains: '123' } },
      { metadata: { path: ['passthrough', 'chatId'], string_contains: '123' } },
    ]);
  });
});
