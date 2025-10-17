const normalizeKeyName = (value) => `${value}`.toLowerCase().replace(/[^a-z0-9]/g, '');

export const toNumber = (value) => {
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

export const pickMetric = (source, keys) => {
  if (!source) return undefined;

  const normalizedTargets = keys.map(normalizeKeyName);
  const visited = new Set();
  const stack = Array.isArray(source) ? [...source] : [source];

  const inspectNested = (value) => {
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
      const fuzzyMatch = normalizedTargets.some((target) =>
        target.length > 0 && normalizedKey.includes(target)
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

export const findStatusCountsSource = (source) => {
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
  const keySet = new Set(['1', '2', '3', '4', '5']);

  const visited = new Set();
  const queue = Array.isArray(source) ? [...source] : [source];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      if (current.length && current.every((value) => typeof value === 'number')) {
        return current;
      }
      for (const entry of current) {
        queue.push(entry);
      }
      continue;
    }

    const record = current;
    const numericKeys = Object.keys(record).filter((key) => keySet.has(key));
    if (numericKeys.length >= 3) {
      return record;
    }

    for (const [propKey, propValue] of Object.entries(record)) {
      const normalizedKey = normalizeKeyName(propKey);
      if (keywords.some((keyword) => normalizedKey.includes(keyword))) {
        if (propValue && typeof propValue === 'object') {
          return propValue;
        }
      }
      if (propValue && typeof propValue === 'object') {
        queue.push(propValue);
      }
    }
  }

  return undefined;
};

export const normalizeStatusCounts = (rawCounts) => {
  const defaultKeys = ['1', '2', '3', '4', '5'];
  const normalized = {};

  if (Array.isArray(rawCounts)) {
    rawCounts.forEach((value, index) => {
      const numeric = toNumber(value);
      if (numeric !== null) {
        normalized[String(index + 1)] = numeric;
      }
    });
  } else if (rawCounts && typeof rawCounts === 'object') {
    for (const [key, value] of Object.entries(rawCounts)) {
      const numeric = toNumber(value);
      if (numeric === null) continue;
      const keyMatch = `${key}`.match(/\d+/);
      const normalizedKey = keyMatch ? keyMatch[0] : `${key}`;
      normalized[normalizedKey] = numeric;
    }
  }

  return defaultKeys.reduce((acc, key, index) => {
    const fallbackKeys = [key, String(index), String(index + 1), `status_${key}`, `status${key}`];
    const value = fallbackKeys.reduce((current, candidate) => {
      if (current !== undefined) return current;
      if (Object.prototype.hasOwnProperty.call(normalized, candidate)) {
        return normalized[candidate];
      }
      return undefined;
    }, undefined);

    acc[key] = typeof value === 'number' ? value : 0;
    return acc;
  }, {});
};

export const findRateSource = (source) => {
  if (!source) {
    return undefined;
  }

  const keywords = ['rateusage', 'ratelimit', 'ratelimiter', 'rate', 'throttle', 'quota'];
  const visited = new Set();
  const queue = Array.isArray(source) ? [...source] : [source];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      for (const entry of current) {
        queue.push(entry);
      }
      continue;
    }

    for (const [propKey, propValue] of Object.entries(current)) {
      const normalizedKey = normalizeKeyName(propKey);
      if (keywords.some((keyword) => normalizedKey.includes(keyword))) {
        if (propValue && typeof propValue === 'object') {
          return propValue;
        }
      }
      if (propValue && typeof propValue === 'object') {
        queue.push(propValue);
      }
    }
  }

  return undefined;
};

export const normalizeRateUsage = (rawRate) => {
  const defaults = {
    used: 0,
    limit: 0,
    remaining: 0,
    percentage: 0,
  };

  if (!rawRate || typeof rawRate !== 'object') {
    return defaults;
  }

  const usedCandidate = toNumber(
    pickMetric(rawRate, ['usage', 'used', 'current', 'value', 'count', 'consumed'])
  );
  const limitCandidate = toNumber(pickMetric(rawRate, ['limit', 'max', 'maximum', 'quota', 'total', 'capacity']));
  const remainingCandidate = toNumber(
    pickMetric(rawRate, ['remaining', 'left', 'available', 'saldo', 'restante'])
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

  const percentage = safeLimit > 0
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

export const mergeMetricsSources = (...sources) => {
  return sources.reduce((acc, source) => {
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      return { ...acc, ...source };
    }
    return acc;
  }, {});
};

export const getInstanceMetrics = (instance) => {
  const metricsSource = mergeMetricsSources(
    instance?.metrics,
    instance?.stats,
    instance?.messages,
    instance?.rawStatus,
    instance
  );
  const sent = pickMetric(metricsSource, ['messagesSent', 'sent', 'totalSent', 'enviadas', 'messages']) ?? 0;
  const queued = pickMetric(metricsSource, ['queued', 'pending', 'fila', 'queueSize', 'waiting']) ?? 0;
  const failed = pickMetric(metricsSource, ['failed', 'errors', 'falhas', 'errorCount']) ?? 0;
  const statusCountsSource =
    findStatusCountsSource(metricsSource) ||
    findStatusCountsSource(metricsSource?.status) ||
    findStatusCountsSource(metricsSource?.messages) ||
    findStatusCountsSource(instance?.statusMetrics);
  const status = normalizeStatusCounts(statusCountsSource);
  const rateUsage = normalizeRateUsage(
    findRateSource(metricsSource) ||
      findRateSource(instance?.rate) ||
      findRateSource(instance?.rawStatus) ||
      findRateSource(instance)
  );

  return { sent, queued, failed, status, rateUsage };
};
