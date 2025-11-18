import { describe, it, expect } from 'vitest';

import { parseListInstancesQuery } from './list-instances';

describe('parseListInstancesQuery', () => {
  it('uses defaults when no values are provided', () => {
    const result = parseListInstancesQuery(undefined);
    expect(result).toEqual({ mode: 'db', fields: 'basic', refreshOverride: null });
  });

  it('picks the first valid string entry from arrays', () => {
    const result = parseListInstancesQuery({
      mode: ['', ' snapshot '],
      fields: [' ', 'metrics'],
      refresh: ['  ', 'YES'],
    });

    expect(result.mode).toBe('snapshot');
    expect(result.fields).toBe('metrics');
    expect(result.refreshOverride).toBe(true);
  });
});
