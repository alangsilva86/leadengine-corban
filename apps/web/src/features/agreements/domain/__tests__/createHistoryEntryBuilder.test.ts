import { describe, expect, it } from 'vitest';
import { createHistoryEntryBuilder } from '../createHistoryEntryBuilder.ts';

describe('createHistoryEntryBuilder', () => {
  it('returns a factory that always uses the provided author', () => {
    const builder = createHistoryEntryBuilder('Admin');
    const entry = builder('Convênio atualizado');

    expect(entry.author).toBe('Admin');
    expect(entry.message).toBe('Convênio atualizado');
    expect(entry.createdAt).toBeInstanceOf(Date);
  });
});
