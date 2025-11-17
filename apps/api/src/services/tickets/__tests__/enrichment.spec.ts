import { describe, expect, it } from 'vitest';
import { mergeEnrichmentMetadata } from '../enrichment';

describe('mergeEnrichmentMetadata', () => {
  it('normalizes and merges enrichment keys from multiple sources', () => {
    const target: Record<string, unknown> = { campaignId: ' 123 ', productType: undefined };
    const sourceA = { campaignName: 'Summer', productType: 'mortgage' };
    const sourceB = { productType: '  ', strategy: 42 };

    mergeEnrichmentMetadata(target, sourceA, sourceB);

    expect(target).toEqual({
      campaignId: '123',
      campaignName: 'Summer',
      productType: 'mortgage',
      strategy: '42',
    });
  });

  it('removes keys when target resolves to undefined', () => {
    const target: Record<string, unknown> = { campaignId: undefined };

    mergeEnrichmentMetadata(target);

    expect(target).toEqual({});
  });
});
