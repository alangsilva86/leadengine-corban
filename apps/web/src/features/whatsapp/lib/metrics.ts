const normalizeKeyName = (value: unknown): string =>
  `${value ?? ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  (isPlainObject(value) ? value : undefined);

export const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }

  return null;
};

export const pickMetric = (source: unknown, keys: string[]): number | undefined => {
  if (!source) return undefined;

  const normalizedTargets = keys.map(normalizeKeyName);
  const visited = new Set<unknown>();
  const stack: unknown[] = Array.isArray(source) ? [...source] : [source];

  const inspectNested = (value: unknown): number | undefined => {
    return pickMetric(value, ['total', 'value', 'count', 'quantity']);
  };

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === null || current === undefined) {
      continue;
    }

    if (typeof current !== 'object') {
      const direct = toNumber(current);
      if (direct !== null) {
        return direct;
      }
      continue;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      for (const entry of current) {
        stack.push(entry);
      }
      continue;
    }

    for (const [propKey, propValue] of Object.entries(current)) {
      const hasExactMatch = keys.includes(propKey);
      const normalizedKey = normalizeKeyName(propKey);
      const fuzzyMatch = normalizedTargets.some(
        (target) => target.length > 0 && normalizedKey.includes(target),
      );

      if (hasExactMatch || fuzzyMatch) {
        const numeric = toNumber(propValue);
        if (numeric !== null) {
          return numeric;
        }
        if (propValue && typeof propValue === 'object') {
          const nested = inspectNested(propValue);
          if (nested !== undefined) {
            return nested;
          }
        }
      }

      if (propValue && typeof propValue === 'object') {
        stack.push(propValue);
      }
    }
  }

  return undefined;
};

const DEFAULT_STATUS_KEYS = ['1', '2', '3', '4', '5'] as const;

type DefaultStatusKey = (typeof DEFAULT_STATUS_KEYS)[number];

export type StatusCounts = Record<DefaultStatusKey, number> & Record<string, number>;

export const findStatusCountsSource = (
  source: unknown,
): Record<string, unknown> | number[] | undefined => {
  if (!source) {
    return undefined;
  }

  const keywords = [
    'statuscounts',
    'statuscount',
    'statusmap',
    'statusmetrics',
    'statuses',
    'bystatus',
    'messagestatuscounts',
    'messagesstatuscounts',
    'status',
  ];
  const keySet = new Set(DEFAULT_STATUS_KEYS);

  const visited = new Set<object>();
  const queue: unknown[] = Array.isArray(source) ? [...source] : [source];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current as object)) {
      continue;
    }
    visited.add(current as object);

    if (Array.isArray(current)) {
      if (current.length && current.every((value) => typeof value === 'number')) {
        return current as number[];
      }
      queue.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    const numericKeys = Object.keys(record).filter((key) => keySet.has(key as DefaultStatusKey));
    if (numericKeys.length >= 3) {
      return record;
    }

    for (const [propKey, propValue] of Object.entries(record)) {
      const normalizedKey = normalizeKeyName(propKey);
      if (keywords.some((keyword) => normalizedKey.includes(keyword))) {
        if (propValue && typeof propValue === 'object') {
          return propValue as Record<string, unknown>;
        }
      }
      if (propValue && typeof propValue === 'object') {
        queue.push(propValue);
      }
    }
  }

  return undefined;
};

export const normalizeStatusCounts = (rawCounts: unknown): StatusCounts => {
  const normalized: Record<string, number> = {};

  if (Array.isArray(rawCounts)) {
    rawCounts.forEach((value, index) => {
      const numeric = toNumber(value);
      if (numeric !== null) {
        normalized[String(index + 1)] = numeric;
      }
    });
  } else if (isPlainObject(rawCounts)) {
    for (const [key, value] of Object.entries(rawCounts)) {
      const numeric = toNumber(value);
      if (numeric === null) continue;
      const keyMatch = `${key}`.match(/\d+/);
      const normalizedKey = keyMatch ? keyMatch[0] : `${key}`;
      normalized[normalizedKey] = numeric;
    }
  }

  return DEFAULT_STATUS_KEYS.reduce((acc, key, index) => {
    const fallbackKeys = [key, String(index), String(index + 1), `status_${key}`, `status${key}`];
    const value = fallbackKeys.reduce<number | undefined>((current, candidate) => {
      if (current !== undefined) return current;
      if (Object.prototype.hasOwnProperty.call(normalized, candidate)) {
        return normalized[candidate];
      }
      return undefined;
    }, undefined);

    acc[key] = typeof value === 'number' ? value : 0;
    return acc;
  }, Object.assign({}, ...DEFAULT_STATUS_KEYS.map((key) => ({ [key]: 0 }))) as StatusCounts);
};

export interface NormalizedRateUsage {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
}

export const findRateSource = (
  source: unknown,
): Record<string, unknown> | number[] | undefined => {
  if (!source) {
    return undefined;
  }

  const keywords = ['rateusage', 'ratelimit', 'ratelimiter', 'rate', 'throttle', 'quota'];
  const visited = new Set<object>();
  const queue: unknown[] = Array.isArray(source) ? [...source] : [source];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current as object)) {
      continue;
    }
    visited.add(current as object);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    for (const [propKey, propValue] of Object.entries(record)) {
      const normalizedKey = normalizeKeyName(propKey);
      if (keywords.some((keyword) => normalizedKey.includes(keyword))) {
        if (propValue && typeof propValue === 'object') {
          return propValue as Record<string, unknown>;
        }
      }
      if (propValue && typeof propValue === 'object') {
        queue.push(propValue);
      }
    }
  }

  return undefined;
};

export const normalizeRateUsage = (rawRate: unknown): NormalizedRateUsage => {
  const defaults: NormalizedRateUsage = {
    used: 0,
    limit: 0,
    remaining: 0,
    percentage: 0,
  };

  if (!isPlainObject(rawRate)) {
    return defaults;
  }

  const usedCandidate = toNumber(
    pickMetric(rawRate, ['usage', 'used', 'current', 'value', 'count', 'consumed']),
  );
  const limitCandidate = toNumber(
    pickMetric(rawRate, ['limit', 'max', 'maximum', 'quota', 'total', 'capacity']),
  );
  const remainingCandidate = toNumber(
    pickMetric(rawRate, ['remaining', 'left', 'available', 'saldo', 'restante']),
  );

  let used = usedCandidate !== null ? usedCandidate : null;
  const limit = limitCandidate !== null ? limitCandidate : null;
  let remaining = remainingCandidate !== null ? remainingCandidate : null;

  if (used === null && remaining !== null && limit !== null) {
    used = limit - remaining;
  }

  if (remaining === null && limit !== null && used !== null) {
    remaining = limit - used;
  }

  used = typeof used === 'number' && Number.isFinite(used) ? Math.max(0, used) : 0;
  const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(0, limit) : 0;
  remaining =
    typeof remaining === 'number' && Number.isFinite(remaining)
      ? Math.max(0, remaining)
      : safeLimit
        ? Math.max(safeLimit - used, 0)
        : 0;

  const percentage =
    safeLimit > 0
      ? Math.min(100, Math.max(0, Math.round((used / safeLimit) * 100)))
      : used > 0
        ? 100
        : 0;

  return {
    used,
    limit: safeLimit,
    remaining,
    percentage,
  };
};

export const mergeMetricsSources = (...sources: unknown[]): Record<string, unknown> => {
  return sources.reduce<Record<string, unknown>>((acc, source) => {
    if (isPlainObject(source)) {
      return { ...acc, ...source };
    }
    return acc;
  }, {});
};

export interface InstanceMetrics {
  sent: number;
  queued: number;
  failed: number;
  status: StatusCounts;
  rateUsage: NormalizedRateUsage;
}

export const getInstanceMetrics = (instance: unknown): InstanceMetrics => {
  const instanceRecord = asRecord(instance) ?? {};
  const metricsSource = mergeMetricsSources(
    instanceRecord.metrics,
    instanceRecord.stats,
    instanceRecord.messages,
    instanceRecord.rawStatus,
    instanceRecord,
  );

  const sent = pickMetric(metricsSource, ['messagesSent', 'sent', 'totalSent', 'enviadas', 'messages']) ?? 0;
  const queued = pickMetric(metricsSource, ['queued', 'pending', 'fila', 'queueSize', 'waiting']) ?? 0;
  const failed = pickMetric(metricsSource, ['failed', 'errors', 'falhas', 'errorCount']) ?? 0;
  const statusCountsSource =
    findStatusCountsSource(metricsSource) ??
    findStatusCountsSource(asRecord(metricsSource.status)) ??
    findStatusCountsSource(asRecord(metricsSource.messages)) ??
    findStatusCountsSource(asRecord(instanceRecord.statusMetrics));
  const status = normalizeStatusCounts(statusCountsSource);
  const rateUsage = normalizeRateUsage(
    findRateSource(metricsSource) ??
      findRateSource(asRecord(instanceRecord.rate)) ??
      findRateSource(asRecord(instanceRecord.rawStatus)) ??
      findRateSource(instanceRecord),
  );

  return { sent, queued, failed, status, rateUsage };
};
