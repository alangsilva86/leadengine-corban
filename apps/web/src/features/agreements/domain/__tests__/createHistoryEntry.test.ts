import { describe, expect, it } from 'vitest';

import { createHistoryEntry } from '../createHistoryEntry.ts';

describe('createHistoryEntry', () => {
  it('creates entries with deterministic data when providing factories', () => {
    const createdAt = new Date('2024-01-01T10:00:00Z');
    const entry = createHistoryEntry({
      author: 'Admin',
      message: 'Convênio atualizado',
      metadata: { scope: 'basic' },
      createdAt,
      idFactory: () => 'history-1',
    });

    expect(entry).toEqual({
      id: 'history-1',
      author: 'Admin',
      message: 'Convênio atualizado',
      createdAt,
      metadata: { scope: 'basic' },
    });
  });

  it('fills optional metadata and timestamp when not provided', () => {
    const entry = createHistoryEntry({
      author: 'Coordenador',
      message: 'Taxa criada',
    });

    expect(entry.metadata).toEqual({});
    expect(entry.createdAt).toBeInstanceOf(Date);
    expect(entry.id).toEqual(expect.any(String));
    expect(entry.id.length).toBeGreaterThan(0);
  });
});
