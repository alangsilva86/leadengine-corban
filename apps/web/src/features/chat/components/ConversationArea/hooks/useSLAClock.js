import { useMemo } from 'react';

const resolveDeadline = (source) => {
  if (!source) return null;
  const candidates = [source.deadline, source.dueAt, source.dueDate, source.expiresAt];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
};

/**
 * Calcula informações derivadas do SLA (tempo restante, atraso etc) para o ticket atual.
 */
export const useSLAClock = (ticket) => {
  return useMemo(() => {
    const sla = ticket?.sla ?? null;
    const deadline = resolveDeadline(sla);
    const now = new Date();
    const deadlineTime = deadline ? deadline.getTime() : null;
    const nowTime = now.getTime();
    const remainingMs = typeof deadlineTime === 'number' ? deadlineTime - nowTime : null;
    const durationMs = typeof sla?.durationMs === 'number' ? sla.durationMs : null;
    const elapsedMs =
      durationMs !== null && typeof remainingMs === 'number' ? Math.max(durationMs - remainingMs, 0) : null;
    const progress =
      durationMs && durationMs > 0 && elapsedMs !== null ? Math.min(Math.max((elapsedMs / durationMs) * 100, 0), 100) : null;

    return {
      deadline,
      remainingMs,
      durationMs,
      progress,
      isOverdue: typeof remainingMs === 'number' ? remainingMs <= 0 : false,
    };
  }, [ticket]);
};

export default useSLAClock;
