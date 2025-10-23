import { useEffect, useMemo, useState } from 'react';

const DEFAULT_WINDOW_MINUTES = 30;
const MS_IN_MINUTE = 60 * 1000;
const MS_IN_SECOND = 1000;

const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const clamp = (value, min = 0, max = 1) => {
  if (Number.isNaN(value)) return 0;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const getWindowMs = (windowMinutes) => {
  const parsed = Number(windowMinutes);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed * MS_IN_MINUTE;
  }
  return DEFAULT_WINDOW_MINUTES * MS_IN_MINUTE;
};

const deriveJroConfig = (ticket) => {
  const internalSla =
    ticket?.metadata?.internalSla ??
    ticket?.metadata?.jro ??
    ticket?.sla?.internal ??
    null;

  const deadline = parseDate(internalSla?.deadline ?? internalSla?.expiresAt ?? ticket?.window?.expiresAt);
  const startedAt = parseDate(internalSla?.startedAt ?? internalSla?.openedAt ?? ticket?.window?.startedAt);
  const windowMs = getWindowMs(internalSla?.windowMinutes ?? internalSla?.windowMs ? internalSla.windowMs / MS_IN_MINUTE : undefined);

  return {
    deadline,
    startedAt,
    windowMs,
  };
};

const formatDuration = (ms) => {
  const totalSeconds = Math.abs(Math.floor(ms / MS_IN_SECOND));
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const computeState = (msRemaining) => {
  if (msRemaining === null || msRemaining === undefined) {
    return 'neutral';
  }
  if (msRemaining < 0) {
    return 'overdue';
  }
  const minutes = msRemaining / MS_IN_MINUTE;
  if (minutes <= 5) {
    return 'orange';
  }
  if (minutes >= 11 && minutes <= 29) {
    return 'yellow';
  }
  return 'neutral';
};

export const useTicketJro = (ticket) => {
  const { deadline, startedAt, windowMs } = useMemo(() => deriveJroConfig(ticket), [ticket]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) {
      return undefined;
    }
    setNow(Date.now());
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, MS_IN_SECOND);
    return () => window.clearInterval(interval);
  }, [deadline]);

  const msRemaining = deadline ? deadline.getTime() - now : null;
  const state = computeState(msRemaining);
  const totalWindowMs = windowMs;

  const progress = useMemo(() => {
    if (!deadline || !totalWindowMs) {
      return 0;
    }
    const effectiveStartedAt = startedAt ?? new Date(deadline.getTime() - totalWindowMs);
    const elapsed = now - effectiveStartedAt.getTime();
    return clamp(elapsed / totalWindowMs);
  }, [deadline, startedAt, totalWindowMs, now]);

  const remainingLabel = deadline ? formatDuration(msRemaining ?? 0) : null;
  const label = deadline
    ? msRemaining >= 0
      ? `SLA interno em ${remainingLabel}`
      : `SLA interno atrasado há ${remainingLabel}`
    : 'SLA interno indisponível';

  return {
    state,
    progress,
    deadline,
    msRemaining,
    label,
    isOverdue: state === 'overdue',
    remainingLabel,
  };
};

export default useTicketJro;
