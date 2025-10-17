import { describe, expect, it } from 'vitest';
import {
  findRateSource,
  findStatusCountsSource,
  getInstanceMetrics,
  normalizeRateUsage,
  normalizeStatusCounts,
  pickMetric,
  toNumber,
} from '../metrics.js';

describe('WhatsApp metrics helpers', () => {
  it('extracts numeric values across nested objects', () => {
    const source = {
      stats: {
        messagesSent: '42',
        queued: { total: '5' },
      },
    };
    expect(pickMetric(source, ['messagesSent'])).toBe(42);
    expect(pickMetric(source.stats, ['queued'])).toBe(5);
  });

  it('converts common numeric representations', () => {
    expect(toNumber('10')).toBe(10);
    expect(toNumber('  ')).toBeNull();
    expect(toNumber(Infinity)).toBeNull();
  });

  it('normalizes status counts regardless of layout', () => {
    const counts = normalizeStatusCounts({ status1: '3', status2: 4, status3: '7' });
    expect(counts[1]).toBe(3);
    expect(counts[2]).toBe(4);
    expect(counts[3]).toBe(7);
    expect(counts[4]).toBe(7);
    expect(counts[5]).toBe(0);

    const fromArray = normalizeStatusCounts([1, 2, 3, 4, 5]);
    expect(fromArray).toMatchObject({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 });
  });

  it('normalizes rate usage inferring missing pieces', () => {
    const usage = normalizeRateUsage({ limit: '100', remaining: 40 });
    expect(usage).toMatchObject({ used: 60, limit: 100, remaining: 40, percentage: 60 });

    const fallback = normalizeRateUsage({ limit: 0, used: 5 });
    expect(fallback.percentage).toBe(100);
  });

  it('finds status and rate sources within mixed payloads', () => {
    const payload = {
      some: { statusCounts: { 1: 1, 2: 2, 3: 3 } },
      metrics: [{ rateLimit: { limit: 10, used: 2 } }],
    };
    expect(findStatusCountsSource(payload)).toEqual({ 1: 1, 2: 2, 3: 3 });
    expect(findRateSource(payload)).toEqual({ limit: 10, used: 2 });
  });

  it('aggregates instance metrics from multiple sources', () => {
    const instance = {
      metrics: { sent: 10, failed: '4' },
      messages: { queued: 5 },
      rawStatus: {
        statusCounts: [0, 1, 2, 3, 4],
        rateUsage: { limit: 20, used: 4 },
      },
    };

    const metrics = getInstanceMetrics(instance);
    expect(metrics.sent).toBe(10);
    expect(metrics.queued).toBe(5);
    expect(metrics.failed).toBe(4);
    expect(metrics.status).toMatchObject({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 });
    expect(metrics.rateUsage).toMatchObject({ limit: 20, used: 4, percentage: 20 });
  });
});
