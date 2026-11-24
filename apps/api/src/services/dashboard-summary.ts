import { prisma } from '../lib/prisma';

const DEFAULT_ZONE = 'America/Sao_Paulo';
const validTimezone = (requested: unknown): string => {
  if (typeof requested !== 'string' || requested.length > 64) return DEFAULT_ZONE;
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: requested });
    return requested;
  } catch {
    return DEFAULT_ZONE;
  }
};

export const getDashboardSummary = async (tenantId: string, requestedTimezone: unknown) => {
  const timezone = validTimezone(requestedTimezone);
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short' });
  const dayLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' });
  const [activeTickets, totalLeads, messages, ticketsByDay, leadsByMonth, channels] = await Promise.all([
    prisma.ticket.count({ where: { tenantId, status: { in: ['OPEN', 'ASSIGNED', 'PENDING'] } } }),
    prisma.lead.count({ where: { tenantId, contact: { tenantId } } }),
    prisma.$queryRaw<{ today: number; yesterday: number }[]>`
      WITH bounds AS (SELECT date_trunc('day', now() AT TIME ZONE ${timezone}) AS start)
      SELECT
        COUNT(*) FILTER (WHERE m."createdAt" >= (bounds.start AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC')::integer AS today,
        COUNT(*) FILTER (WHERE m."createdAt" < (bounds.start AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC')::integer AS yesterday
      FROM "messages" m CROSS JOIN bounds
      WHERE m."tenantId" = ${tenantId} AND m.status <> 'FAILED'
        AND m."createdAt" >= ((bounds.start - INTERVAL '1 day') AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC'
        AND m."createdAt" <= now() AT TIME ZONE 'UTC'
    `,
    prisma.$queryRaw<{ day: string; abertos: number; pendentes: number; fechados: number }[]>`
      WITH days AS (SELECT generate_series(current_day - INTERVAL '6 days', current_day, INTERVAL '1 day') AS day
        FROM (SELECT date_trunc('day', now() AT TIME ZONE ${timezone}) AS current_day) bounds)
      SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE t.status IN ('OPEN', 'ASSIGNED'))::integer AS abertos,
        COUNT(*) FILTER (WHERE t.status = 'PENDING')::integer AS pendentes,
        COUNT(*) FILTER (WHERE t.status IN ('CLOSED', 'RESOLVED'))::integer AS fechados
      FROM days LEFT JOIN "tickets" t ON t."tenantId" = ${tenantId}
        AND t."createdAt" >= (days.day AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC'
        AND t."createdAt" < ((days.day + INTERVAL '1 day') AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC'
      GROUP BY days.day ORDER BY days.day
    `,
    prisma.$queryRaw<{ month: string; leads: number }[]>`
      WITH months AS (SELECT generate_series(current_month - INTERVAL '5 months', current_month, INTERVAL '1 month') AS month
        FROM (SELECT date_trunc('month', now() AT TIME ZONE ${timezone}) AS current_month) bounds)
      SELECT to_char(months.month, 'YYYY-MM-DD') AS month, COUNT(l.id)::integer AS leads
      FROM months LEFT JOIN "leads" l ON l."tenantId" = ${tenantId}
        AND l."createdAt" >= (months.month AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC'
        AND l."createdAt" < ((months.month + INTERVAL '1 month') AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC'
      GROUP BY months.month ORDER BY months.month
    `,
    prisma.ticket.groupBy({ by: ['channel'], where: { tenantId }, _count: { _all: true } }),
  ]);

  return {
    source: 'postgres', timezone, retrievedAt: new Date(), activeTickets, totalLeads,
    messagesToday: messages[0]?.today ?? 0, messagesYesterday: messages[0]?.yesterday ?? 0,
    ticketsSeries: ticketsByDay.map(({ day, ...counts }) => ({ name: dayLabel.format(new Date(day)), ...counts })),
    leadsSeries: leadsByMonth.map(({ month, leads }) => ({ name: monthLabel.format(new Date(month)), leads })),
    channels: channels.map(({ channel, _count }) => ({ channel, total: _count._all })),
    conversionRate: null,
  };
};
