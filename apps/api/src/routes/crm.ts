import { Router, type Request, type Response } from 'express';
import { LeadSource, type Prisma } from '@prisma/client';
import {
  CLOSED_LEAD_STAGES,
  LEAD_STAGES,
  LEAD_STAGE_DEFINITIONS,
  parseLeadStage,
  type LeadStage,
} from '../lib/lead-stages';
import { NotFoundError, ValidationError } from '@ticketz/core';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getDashboardSummary } from '../services/dashboard-summary';
import { sendLeadStageError, setLeadStage } from '../services/leads/lead-stage-service';
import { opportunitiesRouter } from './opportunities';

const crmRouter = Router();
crmRouter.use(requireTenant);
crmRouter.use('/opportunities', opportunitiesRouter);
crmRouter.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, tenant } = req.user!;
  const data = await getDashboardSummary(tenantId, tenant?.settings.timezone);
  res.json({ success: true, data });
}));

const DAY = 86_400_000;
const PAGE_SIZE = 50;
/**
 * Colunas do Kanban antigo (antes do funil único) → etapas do lead. Mantido só para que clientes
 * antigos que ainda enviem esses ids em `filters.stages` continuem filtrando corretamente.
 */
const LEGACY_KANBAN_STAGE_FILTERS: Record<string, readonly LeadStage[]> = {
  qualification: ['novo', 'contato', 'qualificacao', 'reciclar'],
  proposal: ['proposta'],
  negotiation: ['documentacao', 'averbacao', 'liquidacao'],
  'closed-won': ['ganho'],
  'closed-lost': ['perdido'],
};
const resolveStageFilter = (values: string[]): LeadStage[] => {
  const resolved = new Set<LeadStage>();
  for (const value of values) {
    const legacyColumn = Object.prototype.hasOwnProperty.call(LEGACY_KANBAN_STAGE_FILTERS, value)
      ? LEGACY_KANBAN_STAGE_FILTERS[value]
      : undefined;
    const stages = legacyColumn ?? [parseLeadStage(value)].filter((stage): stage is LeadStage => stage !== null);
    stages.forEach((stage) => resolved.add(stage));
  }
  return [...resolved];
};
const openLeads: Prisma.LeadWhereInput = { stage: { notIn: [...CLOSED_LEAD_STAGES] } };

const filterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  stages: z.array(z.string()).max(20).optional(),
  owners: z.array(z.string()).max(30).optional(),
  origins: z.array(z.string()).max(30).optional(),
  channels: z.array(z.string()).max(30).optional(),
  inactivityDays: z.number().finite().min(0).max(3650).nullish(),
  score: z.object({ min: z.number().finite().nullish(), max: z.number().finite().nullish() }).nullish(),
  dateRange: z.object({ from: z.string().nullish(), to: z.string().nullish() }).nullish(),
});
const parseFilters = (raw: unknown) => {
  try {
    return filterSchema.parse(typeof raw === 'string' ? JSON.parse(raw) : {});
  } catch {
    throw new ValidationError('Filtros de CRM inválidos.');
  }
};
const toDate = (value: unknown) => {
  if (value == null) return undefined;
  const date = new Date(typeof value === 'string' ? value : Number.NaN);
  if (!Number.isFinite(date.getTime())) throw new ValidationError('Data inválida.');
  return date;
};

const leadScope = (tenantId: string): Prisma.LeadWhereInput => ({
  tenantId,
  contact: { tenantId },
  AND: [
    { OR: [{ userId: null }, { assignee: { tenantId } }] },
    { OR: [{ campaignId: null }, { campaign: { tenantId } }] },
  ],
});

const filteredLeads = (tenantId: string, userId: string, raw: unknown): Prisma.LeadWhereInput => {
  const filters = parseFilters(raw);
  const from = toDate(filters.dateRange?.from);
  const to = toDate(filters.dateRange?.to);
  const sourceMap = { web: 'WEBSITE', ads: 'PAID_ADS', organic: 'ORGANIC', social: 'SOCIAL_MEDIA' } as const;
  const validSources = new Set<string>(Object.values(LeadSource));
  const expandSources = (values?: string[]) => (values ?? []).map((entry) =>
    sourceMap[entry as keyof typeof sourceMap] ?? entry.toUpperCase()
  ).filter((entry) => validSources.has(entry)) as LeadSource[];
  const and: Prisma.LeadWhereInput[] = [leadScope(tenantId)];
  if (filters.stages?.length) and.push({ stage: { in: resolveStageFilter(filters.stages) } });
  if (filters.search) and.push({ contact: { fullName: { contains: filters.search, mode: 'insensitive' } } });
  if (filters.owners?.length) and.push({ userId: { in: filters.owners.map(id => id === 'owner:me' ? userId : id) } });
  if (filters.origins?.length) and.push({ source: { in: expandSources(filters.origins) } });
  if (filters.channels?.length) and.push({ source: { in: expandSources(filters.channels) } });
  if (filters.score?.min != null) and.push({ score: { path: ['value'], gte: filters.score.min } });
  if (filters.score?.max != null) and.push({ score: { path: ['value'], lte: filters.score.max } });
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  if (filters.inactivityDays != null) and.push({ updatedAt: { lte: new Date(Date.now() - filters.inactivityDays * DAY) } });
  return { AND: and };
};

const leadSelect = {
  id: true, stage: true, status: true, value: true, source: true, updatedAt: true,
  contact: { select: { id: true, fullName: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.LeadSelect;
const summarize = (lead: Prisma.LeadGetPayload<{ select: typeof leadSelect }>) => ({
  id: lead.id, name: lead.contact.fullName, contactId: lead.contact.id, stage: lead.stage as LeadStage,
  ownerId: lead.assignee?.id ?? null, ownerName: lead.assignee?.name ?? null, lastActivityAt: lead.updatedAt,
  source: lead.source.toLowerCase(), channel: ['WHATSAPP', 'EMAIL', 'PHONE', 'WEBSITE'].includes(lead.source) ? lead.source.toLowerCase() : null,
  potentialValue: lead.value,
  status: lead.status === 'CONVERTED' ? 'won' : lead.status === 'LOST' ? 'lost' :
    lead.status === 'NEW' ? 'new' : lead.status === 'ENGAGED' ? 'engaged' : 'in_progress',
});

crmRouter.get('/leads', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, id } = req.user!;
  const where = filteredLeads(tenantId, id, req.query.filters);
  const cursor = typeof req.query.cursor === 'string' && req.query.cursor.length < 120 ? req.query.cursor : undefined;
  const [records, total] = await Promise.all([
    prisma.lead.findMany({ where: { AND: [where, ...(cursor ? [{ id: { lt: cursor } }] : [])] },
      orderBy: { id: 'desc' }, take: PAGE_SIZE + 1, select: leadSelect }),
    prisma.lead.count({ where }),
  ]);
  const page = records.slice(0, PAGE_SIZE);
  res.json({ success: true, data: { items: page.map(summarize), total,
    nextCursor: records.length > PAGE_SIZE ? page.at(-1)?.id : null } });
}));

crmRouter.get('/leads/:leadId', asyncHandler(async (req: Request, res: Response) => {
  const lead = await prisma.lead.findFirst({
    where: { AND: [{ id: req.params.leadId ?? '' }, leadScope(req.user!.tenantId)] },
    select: { ...leadSelect, notes: true, score: true },
  });
  if (!lead) throw new NotFoundError('Lead', req.params.leadId ?? '');
  res.json({ success: true, data: { ...summarize(lead), notes: lead.notes } });
}));

const stageInput = z.object({
  stage: z.string().trim().min(1).max(40),
  reason: z.string().trim().max(500).nullish(),
});

/**
 * PATCH /api/crm/leads/:leadId/stage — muda a etapa do lead (funil único).
 * Também alinha a etapa de todas as conversas abertas do contato (Inbox).
 */
crmRouter.patch('/leads/:leadId/stage', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, id: actorId } = req.user!;
  const leadId = req.params.leadId ?? '';
  const parsed = stageInput.safeParse(req.body ?? {});
  const stage = parsed.success ? parseLeadStage(parsed.data.stage, { legacy: false }) : null;
  if (!parsed.success || !stage) {
    res.locals.errorCode = 'VALIDATION_ERROR';
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.success
          ? `Etapa inválida. Use uma destas: ${LEAD_STAGES.join(', ')}.`
          : 'Informe a etapa (stage) e, se quiser, um motivo (reason) de até 500 caracteres.',
      },
    });
    return;
  }

  const scoped = { AND: [{ id: leadId }, leadScope(tenantId)] } satisfies Prisma.LeadWhereInput;
  const existing = await prisma.lead.findFirst({ where: scoped, select: { id: true } });
  if (!existing) {
    sendLeadStageError(res, new NotFoundError('Lead', leadId));
    return;
  }

  try {
    await setLeadStage({ tenantId, leadId, stage, actorId, reason: parsed.data.reason ?? null, source: 'crm' });
  } catch (error) {
    if (sendLeadStageError(res, error)) return;
    throw error;
  }

  const lead = await prisma.lead.findFirst({ where: scoped, select: leadSelect });
  if (!lead) throw new NotFoundError('Lead', leadId);
  res.json({ success: true, data: summarize(lead) });
}));

crmRouter.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, id } = req.user!;
  const filters = filteredLeads(tenantId, id, req.query.filters);
  const now = new Date();
  const since = new Date(now.getTime() - 7 * DAY);
  const [active, newLeads, stalled] = await Promise.all([
    prisma.lead.count({ where: { AND: [filters, openLeads] } }),
    prisma.lead.count({ where: { AND: [filters, { createdAt: { gte: since, lte: now } }] } }),
    prisma.lead.count({ where: { AND: [filters, openLeads, { updatedAt: { lt: since } }] } }),
  ]);
  const summary = [
    { id: 'activeLeads', label: 'Leads ativos', value: active },
    { id: 'newLeads', label: 'Novos nos últimos 7 dias', value: newLeads },
    { id: 'stalledLeads', label: 'Sem atualização há 7 dias', value: stalled },
  ].map((metric) => ({ ...metric, unit: 'count' }));
  res.json({ success: true, data: { summary, retrievedAt: now, source: 'api' } });
}));

crmRouter.get('/aging', asyncHandler(async (req: Request, res: Response) => {
  const now = Date.now();
  const where = filteredLeads(req.user!.tenantId, req.user!.id, req.query.filters);
  const ages = [
    { id: '0-1', label: '0–1 dia', min: 0, max: 2 },
    { id: '2-3', label: '2–3 dias', min: 2, max: 4 },
    { id: '4-7', label: '4–7 dias', min: 4, max: 8 },
    { id: '8-14', label: '8–14 dias', min: 8, max: 15 },
    { id: '15+', label: '15+ dias', min: 15, max: null },
  ];
  const groups = await Promise.all(ages.map(({ min, max }) => prisma.lead.groupBy({
    by: ['stage'], where: { AND: [where, { updatedAt: {
      lte: new Date(now - min * DAY), ...(max !== null ? { gt: new Date(now - max * DAY) } : {}),
    } }] }, _count: { _all: true },
  })));
  const buckets = ages.flatMap((age, i) => LEAD_STAGES.map(stage => ({
    stageId: stage, stageName: LEAD_STAGE_DEFINITIONS[stage].label, bucketId: age.id, bucketLabel: age.label,
    leadCount: (groups[i] ?? []).filter(row => row.stage === stage).reduce((total, row) => total + row._count._all, 0),
  })));
  res.json({ success: true, data: { buckets, generatedAt: new Date(now) } });
}));

const eventTypes = new Map<string, string>([
  ['CALL_MADE', 'call'], ['CALL_ANSWERED', 'call'], ['MEETING_SCHEDULED', 'meeting'],
  ['MEETING_COMPLETED', 'meeting'], ['STATUS_CHANGED', 'status_change'],
  ['WHATSAPP_SENT', 'message'], ['WHATSAPP_REPLIED', 'message'], ['EMAIL_SENT', 'message'],
]);

for (const route of ['/timeline', '/leads/:leadId/timeline']) {
  crmRouter.get(route, asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, id } = req.user!;
    const types = typeof req.query.types === 'string' ? req.query.types.split(',') : null;
    const leadId = req.params.leadId;
    const events = await prisma.leadActivity.findMany({
      where: { tenantId, ...(leadId ? { leadId } : {}), lead: filteredLeads(tenantId, id, req.query.filters) },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 100,
      select: { id: true, type: true, title: true, description: true, occurredAt: true },
    });
    const items = events.map(({ type, occurredAt, ...event }) => ({
      ...event, type: eventTypes.get(type) ?? 'note', timestamp: occurredAt,
    })).filter(event => !types || types.includes(event.type));
    res.json({ success: true, data: leadId ? items : { items } });
  }));
}

for (const route of ['/tasks', '/leads/:leadId/tasks']) {
  crmRouter.get(route, asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, id } = req.user!;
    const leadId = req.params.leadId;
    const where = { AND: [filteredLeads(tenantId, id, req.query.filters), ...(leadId ? [{ id: leadId }] : [])] };
    const from = toDate(req.query.from);
    const to = toDate(req.query.to);
    const tasks = await prisma.contactTask.findMany({
      where: {
        tenantId,
        dueAt: { not: null, ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
        status: { not: 'CANCELLED' }, contact: { tenantId, leads: { some: where } },
        OR: [{ assigneeId: null }, { assignee: { tenantId } }],
      },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 100,
      select: { id: true, title: true, dueAt: true, status: true, assigneeId: true,
        assignee: { select: { name: true } },
        contact: { select: { fullName: true, leads: { where, select: { id: true }, take: 1 } } } },
    });
    const items = tasks.map((task) => ({
      id: task.id, title: task.title, dueDate: task.dueAt,
      status: task.status === 'COMPLETED' ? 'completed' : task.dueAt! < new Date() ? 'overdue' : 'pending',
      ownerId: task.assigneeId, ownerName: task.assignee?.name ?? null,
      leadId: task.contact.leads[0]?.id ?? null, leadName: task.contact.fullName,
    }));
    res.json({ success: true, data: leadId ? items : { items } });
  }));
}

export { crmRouter };
