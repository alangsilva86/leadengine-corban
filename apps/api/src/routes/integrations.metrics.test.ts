import { describe, expect, it } from 'vitest';

import { __testing } from './integrations';

const {
  serializeStoredInstance,
  normalizeStatusCountsData,
  normalizeRateUsageData,
  collectNumericFromSources,
} = __testing;

describe('WhatsApp integrations metrics normalization', () => {
  it('flattens nested broker metrics into top-level counters', () => {
    const baseInstance = {
      id: 'inst-1',
      tenantId: 'tenant-1',
      name: 'Instance 1',
      status: 'connecting',
      connected: false,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      lastSeenAt: null,
      phoneNumber: null,
      brokerId: 'inst-1',
      metadata: {},
    } as any;

    const brokerStatus = {
      status: 'connected',
      connected: true,
      metrics: {
        messages: {
          sent: { total: 18 },
        },
      },
      messages: {
        queue: { size: 5 },
        failures: { total: '2' },
        statusCounts: { '1': '3', status_2: 4 },
      },
      rateUsage: {
        used: '40',
        limit: '100',
      },
      raw: {
        metrics: {
          throttle: { remaining: 60, limit: 100 },
        },
        messages: {
          pending: { total: 5 },
        },
      },
    } as any;

    const serialized = serializeStoredInstance(baseInstance, brokerStatus);

    expect(serialized.metrics).toBeDefined();
    expect(serialized.metrics?.messagesSent).toBe(18);
    expect(serialized.metrics?.sent).toBe(18);
    expect(serialized.metrics?.queued).toBe(5);
    expect(serialized.metrics?.failed).toBe(2);
    expect(serialized.metrics?.statusCounts).toEqual({
      '1': 3,
      '2': 4,
      '3': 0,
      '4': 0,
      '5': 0,
    });
    expect(serialized.metrics?.rateUsage).toEqual({
      used: 40,
      limit: 100,
      remaining: 60,
      percentage: 40,
    });

    expect(serialized.metadata?.normalizedMetrics).toMatchObject({
      messagesSent: 18,
      queued: 5,
      failed: 2,
    });
  });

  it('normalizes status counts from arrays and objects', () => {
    expect(normalizeStatusCountsData([1, 2, 3, 4, 5])).toEqual({
      '1': 1,
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
    });

    expect(
      normalizeStatusCountsData({
        status_1: '6',
        status_2: 7,
        status_5: '11',
      })
    ).toEqual({
      '1': 6,
      '2': 7,
      '3': 0,
      '4': 0,
      '5': 11,
    });
  });

  it('derives rate usage metrics even with partial information', () => {
    expect(
      normalizeRateUsageData({
        limit: 200,
        remaining: 120,
      })
    ).toEqual({
      used: 80,
      limit: 200,
      remaining: 120,
      percentage: 40,
    });

    expect(normalizeRateUsageData(null)).toBeNull();
  });

  it('returns null when no numeric candidates are found', () => {
    expect(
      collectNumericFromSources(
        [
          { something: { else: 'value' } },
          { nested: [{ still: 'nothing' }] },
        ],
        ['sent']
      )
    ).toBeNull();
  });
});
