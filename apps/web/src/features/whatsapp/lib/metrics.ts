const normalizeKeyName = (value: unknown): string =>
  `${value}`.toLowerCase().replace(/[^a-z0-9]/g, '');

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
    const nested = pickMetric(value, ['total', 'value', 'count', 'quantity']);
    return nested;
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
