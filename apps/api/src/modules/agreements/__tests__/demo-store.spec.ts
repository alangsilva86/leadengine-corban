import { describe, expect, it } from 'vitest';

import { DemoAgreementsStore } from '../demo-store';

const pagination = { page: 1, limit: 10 } as const;

describe('DemoAgreementsStore', () => {
  it('bootstraps state for tenants not present in the seed list', async () => {
    const store = new DemoAgreementsStore();
    const tenantId = 'tenant-fallback-123';

    const created = await store.createAgreement({
      tenantId,
      name: 'Convênio fallback',
      slug: 'convenio-fallback',
      status: 'draft',
      archived: false,
      metadata: {},
      products: {},
      tags: [],
      description: null,
      segment: null,
      type: null,
      publishedAt: null,
    });

    expect(created.tenantId).toBe(tenantId);

    const list = await store.listAgreements(tenantId, {}, pagination);
    const ids = list.items.map((item) => item.id);

    expect(ids).toContain(created.id);
  });
});
