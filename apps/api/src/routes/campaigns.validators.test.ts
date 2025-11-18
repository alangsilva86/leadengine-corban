import { describe, it, expect } from 'vitest';

import { buildFilters, DEFAULT_STATUS } from './campaigns.validators';

describe('buildFilters', () => {
  it('normalizes multi-value query params', () => {
    const filters = buildFilters({
      agreementId: ['', ' AG-1 '],
      instanceId: [' ', 'INST-99'],
      productType: [' ', ' product '],
      marginType: ['  '],
      strategy: ['a', '  '],
      tags: ['foo, bar ', 'foo'],
    } as never);

    expect(filters.agreementId).toBe('AG-1');
    expect(filters.instanceId).toBe('INST-99');
    expect(filters.productType).toBe('product');
    expect(filters.marginType).toBeUndefined();
    expect(filters.strategy).toBe('a');
    expect(filters.tags).toEqual(['foo', 'bar']);
    expect(filters.statuses).toEqual([DEFAULT_STATUS]);
  });
});
