import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { canTransitionLeadStage, parseLeadStage, type LeadStage } from '../lib/lead-stages';
import { ConflictError, NotFoundError, ValidationError } from '@ticketz/core';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/error-handler';

const router = Router();
const reference = z.string().trim().min(1).max(80);
const nextAction = z.string().trim().min(1).max(300);
const nextActionAt = z.iso.datetime({ offset: true }).transform(s => new Date(s)).nullable().optional();
const createInput = z.object({
  contactId: reference, leadId: reference.optional(), agreementRef: reference,
  employmentRef: reference, productRef: reference, nextAction, nextActionAt,
});
/** Oportunidades usam o funil único do lead (LeadStage). Valores legados (PREPARATION…) são normalizados. */
const stageSchema = z.string().trim().min(1).max(40).transform((value, ctx) => {
  const parsed = parseLeadStage(value);
  if (!parsed) {
    ctx.addIssue({ code: 'custom', message: 'Etapa inválida.' });
    return z.NEVER;
  }
  return parsed;
});
const DEFAULT_OPPORTUNITY_STAGE: LeadStage = 'qualificacao';
const updateInput = z.object({
  version: z.number().int().positive(), stage: stageSchema,
  nextAction, nextActionAt, reason: z.string().trim().min(1).max(200),
});

const opportunitySelect = {
  id: true, contactId: true, leadId: true, ownerId: true, agreementRef: true,
  employmentRef: true, productRef: true, stage: true, version: true,
  nextAction: true, nextActionAt: true, updatedAt: true,
  contact: { select: { fullName: true } }, owner: { select: { name: true } },
} satisfies Prisma.OpportunitySelect;

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const cursor = typeof req.query.cursor === 'string' && req.query.cursor.length < 120 ? req.query.cursor : null;
  const contactId = typeof req.query.contactId === 'string' && req.query.contactId.length < 120 ? req.query.contactId : undefined;
  const records = await prisma.opportunity.findMany({
    where: { tenantId, ...(contactId ? { contactId } : {}), ...(cursor ? { id: { lt: cursor } } : {}) },
    orderBy: { id: 'desc' }, take: 51, select: opportunitySelect,
  });
  const items = records.slice(0, 50);
  res.json({ success: true, data: { items, nextCursor: records.length > 50 ? items.at(-1)?.id : null } });
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, id: ownerId } = req.user!;
  const key = z.guid().safeParse(req.header('Idempotency-Key'));
  const parsed = createInput.safeParse(req.body);
  if (!key.success || !parsed.success) {
    throw new ValidationError('Informe contato, convênio, vínculo, produto, próxima ação e a chave do cadastro.');
  }

  const { contactId, leadId, agreementRef, employmentRef, productRef, nextAction, nextActionAt } = parsed.data;
  const intentKey = key.data;
  const [contact, lead] = await Promise.all([
    prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { id: true } }),
    leadId ? prisma.lead.findFirst({ where: { id: leadId, contactId, tenantId }, select: { id: true } }) : null,
  ]);
  if (!contact) throw new NotFoundError('Contact', contactId);
  if (leadId && !lead) throw new NotFoundError('Lead', leadId);

  try {
    const record = await prisma.opportunity.create({
      data: {
        tenantId, contactId, leadId: leadId ?? null, ownerId, intentKey, agreementRef, employmentRef,
        productRef, nextAction, nextActionAt: nextActionAt ?? null,
        stage: DEFAULT_OPPORTUNITY_STAGE,
        activities: { create: { version: 1, stage: DEFAULT_OPPORTUNITY_STAGE, reason: 'Oportunidade registrada', actorId: ownerId } },
      },
      select: opportunitySelect,
    });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    const record = await prisma.opportunity.findUnique({ where: { tenantId_intentKey: { tenantId, intentKey } }, select: opportunitySelect });
    if (!record || record.contactId !== contactId || record.leadId !== (leadId ?? null) || record.ownerId !== ownerId
      || record.agreementRef !== agreementRef || record.employmentRef !== employmentRef || record.productRef !== productRef) {
      throw new ConflictError('A chave já foi usada para outra oportunidade.');
    }
    res.json({ success: true, data: record });
  }
}));

router.get('/:opportunityId', asyncHandler(async (req: Request, res: Response) => {
  const record = await prisma.opportunity.findFirst({
    where: { tenantId: req.user!.tenantId, id: req.params.opportunityId ?? '' },
    select: { ...opportunitySelect, activities: { orderBy: { version: 'desc' }, take: 100,
      select: { id: true, version: true, stage: true, reason: true, createdAt: true } } },
  });
  if (!record) throw new NotFoundError('Opportunity', req.params.opportunityId ?? '');
  res.json({ success: true, data: record });
}));

router.patch('/:opportunityId', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, id: actorId } = req.user!;
  const id = req.params.opportunityId ?? '';
  const parsed = updateInput.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Informe a versão, etapa, motivo e próxima ação.');
  const { version, stage, nextAction, nextActionAt, reason } = parsed.data;

  const record = await prisma.$transaction(async tx => {
    const existing = await tx.opportunity.findFirst({ where: { id, tenantId }, select: { stage: true, version: true } });
    if (!existing) throw new NotFoundError('Opportunity', id);
    if (existing.version !== version) throw new ConflictError('A oportunidade mudou. Atualize antes de salvar novamente.');
    if (!canTransitionLeadStage(existing.stage as LeadStage, stage)) {
      throw new ConflictError('Esta transição de etapa não é permitida.');
    }
    const updated = await tx.opportunity.updateMany({
      where: { id, tenantId, version }, data: { stage, nextAction, ...(nextActionAt !== undefined ? { nextActionAt } : {}), version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConflictError('A oportunidade mudou. Atualize antes de salvar novamente.');
    await tx.opportunityActivity.create({ data: { opportunityId: id, version: version + 1, actorId, stage, reason } });
    return tx.opportunity.findFirst({ where: { id, tenantId }, select: opportunitySelect });
  });
  res.json({ success: true, data: record });
}));

export { router as opportunitiesRouter };
