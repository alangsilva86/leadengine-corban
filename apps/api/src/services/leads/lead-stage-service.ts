import type { Response } from 'express';
import type { Lead as PrismaLead, LeadActivity as PrismaLeadActivity, LeadStatus, Prisma } from '@prisma/client';
import {
  LEAD_STAGE_DEFINITIONS,
  LEAD_STAGE_TO_LEGACY_LEAD_STATUS,
  canTransitionLeadStage,
  getLeadStageLabel,
  type LeadStage,
} from '../../lib/lead-stages';
import { ConflictError, NotFoundError, ValidationError } from '@ticketz/core';
import { findTicketById } from '@ticketz/storage';
import { prisma } from '../../lib/prisma';
import { logger } from '../../config/logger';
import { emitToTenant } from '../../lib/socket-registry';
import { buildTicketRealtimeEnvelope, emitTicketRealtimeEnvelope } from '../tickets/shared/realtime';
import { resolveWhatsAppInstanceId } from '../tickets/shared/whatsapp';

/**
 * Caminho único de escrita da etapa do lead ("funil único do lead").
 *
 * O lead é o dono da etapa. CRM, Inbox e Oportunidades chamam `setLeadStage`, que em uma transação:
 *   1. valida a transição (`canTransitionLeadStage`);
 *   2. grava `lead.stage` e espelha `lead.status` (LEAD_STAGE_TO_LEGACY_LEAD_STATUS) para integrações;
 *   3. registra uma `LeadActivity` STATUS_CHANGED com from/to/motivo/origem;
 *   4. alinha a etapa de todos os tickets abertos (OPEN/PENDING/ASSIGNED) do contato.
 * Depois do COMMIT emite `tickets.updated` para cada ticket alinhado e `leads.updated` para o tenant.
 */

export type LeadStageChangeSource = 'crm' | 'inbox' | 'opportunity';

/** Status de ticket considerados "abertos" — a etapa deles acompanha a do lead. */
export const OPEN_TICKET_STATUSES = ['OPEN', 'PENDING', 'ASSIGNED'] as const;

export interface SetLeadStageInput {
  tenantId: string;
  /** Lead alvo. Informe `leadId` ou `contactId`. */
  leadId?: string | null;
  /** Contato do lead (alternativa a `leadId`; o lead é único por contato no tenant). */
  contactId?: string | null;
  stage: LeadStage;
  actorId?: string | null;
  reason?: string | null;
  source: LeadStageChangeSource;
}

export interface SetLeadStageResult {
  lead: PrismaLead;
  previousStage: LeadStage;
  stage: LeadStage;
  /** `false` quando o lead já estava na etapa (nenhuma atividade é registrada). */
  changed: boolean;
  activity: PrismaLeadActivity | null;
  /** Tickets abertos do contato cuja etapa foi alinhada nesta chamada. */
  syncedTicketIds: string[];
}

export class InvalidLeadStageTransitionError extends ConflictError {
  public readonly from: LeadStage;
  public readonly to: LeadStage;

  constructor(from: LeadStage, to: LeadStage) {
    super(describeInvalidTransition(from, to), { code: 'INVALID_STAGE_TRANSITION', from, to });
    this.from = from;
    this.to = to;
  }
}

const STAGE_CONFLICT_MESSAGE = 'A etapa do lead mudou enquanto você editava. Atualize e tente novamente.';

/** Mudança concorrente: a etapa do lead mudou entre a leitura e a escrita. */
export class LeadStageConflictError extends ConflictError {
  constructor() {
    super(STAGE_CONFLICT_MESSAGE, { code: 'STAGE_CONFLICT' });
  }
}

const describeInvalidTransition = (from: LeadStage, to: LeadStage): string => {
  const toLabel = getLeadStageLabel(to);
  if (from === 'ganho') {
    return `Este lead já foi ganho e não pode ir para "${toLabel}".`;
  }
  if (from === 'perdido') {
    return `Lead perdido só volta ao funil pela etapa "${getLeadStageLabel('reciclar')}".`;
  }
  return `Não é possível mover o lead de "${getLeadStageLabel(from)}" para "${toLabel}".`;
};

const normalizeReason = (reason: string | null | undefined): string | null => {
  if (typeof reason !== 'string') return null;
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
};

const buildLeadUpdate = (
  from: LeadStage,
  to: LeadStage,
  reason: string | null,
  now: Date
): Prisma.LeadUpdateManyMutationInput => {
  const data: Prisma.LeadUpdateManyMutationInput = {
    stage: to,
    status: LEAD_STAGE_TO_LEGACY_LEAD_STATUS[to] as LeadStatus,
  };

  if (to === 'ganho' || to === 'perdido') {
    data.actualCloseDate = now;
  } else if (LEAD_STAGE_DEFINITIONS[from].terminal) {
    // Reabertura (perdido → reciclar): o lead deixa de estar encerrado.
    data.actualCloseDate = null;
  }

  if (to === 'perdido' && reason) {
    data.lostReason = reason;
  }

  return data;
};

export const setLeadStage = async (input: SetLeadStageInput): Promise<SetLeadStageResult> => {
  const { tenantId, stage: to, source } = input;
  const leadId = input.leadId?.trim() || null;
  const contactId = input.contactId?.trim() || null;
  const actorId = input.actorId ?? null;
  const reason = normalizeReason(input.reason);

  if (!leadId && !contactId) {
    throw new ValidationError('Informe o lead ou o contato para alterar a etapa.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({
      where: {
        tenantId,
        contact: { tenantId },
        ...(leadId ? { id: leadId } : {}),
        ...(contactId ? { contactId } : {}),
      },
    });

    if (!lead) {
      throw new NotFoundError('Lead', leadId ?? contactId ?? '');
    }

    const from = lead.stage as LeadStage;
    if (!canTransitionLeadStage(from, to)) {
      throw new InvalidLeadStageTransitionError(from, to);
    }

    let updatedLead: PrismaLead = lead;
    let activity: PrismaLeadActivity | null = null;

    if (from !== to) {
      const now = new Date();
      const data = buildLeadUpdate(from, to, reason, now);
      const updated = await tx.lead.updateMany({
        where: { id: lead.id, tenantId, stage: lead.stage },
        data,
      });

      if (updated.count === 0) {
        throw new LeadStageConflictError();
      }

      updatedLead = await tx.lead.findUniqueOrThrow({ where: { id: lead.id } });

      activity = await tx.leadActivity.create({
        data: {
          tenantId,
          leadId: lead.id,
          userId: actorId,
          type: 'STATUS_CHANGED',
          title: `Etapa alterada: ${getLeadStageLabel(from)} → ${getLeadStageLabel(to)}`,
          description: reason,
          metadata: {
            from,
            to,
            reason,
            source,
            previousStatus: lead.status,
            status: updatedLead.status,
            actorId,
          },
          occurredAt: now,
        },
      });
    }

    const ticketsToSync = await tx.ticket.findMany({
      where: {
        tenantId,
        contactId: lead.contactId,
        status: { in: [...OPEN_TICKET_STATUSES] },
        stage: { not: to },
      },
      select: { id: true },
    });
    const syncedTicketIds = ticketsToSync.map((ticket) => ticket.id);

    if (syncedTicketIds.length > 0) {
      await tx.ticket.updateMany({
        where: { tenantId, id: { in: syncedTicketIds } },
        data: { stage: to },
      });
    }

    return {
      lead: updatedLead,
      previousStage: from,
      stage: to,
      changed: from !== to,
      activity,
      syncedTicketIds,
    } satisfies SetLeadStageResult;
  });

  await broadcastLeadStageChange(tenantId, result, source, actorId);

  return result;
};

const broadcastLeadStageChange = async (
  tenantId: string,
  result: SetLeadStageResult,
  source: LeadStageChangeSource,
  actorId: string | null
): Promise<void> => {
  for (const ticketId of result.syncedTicketIds) {
    try {
      const ticket = await findTicketById(tenantId, ticketId);
      if (!ticket) continue;
      const envelope = buildTicketRealtimeEnvelope({
        tenantId,
        ticket,
        instanceId: resolveWhatsAppInstanceId(ticket),
      });
      emitTicketRealtimeEnvelope(tenantId, ticket, envelope, actorId);
    } catch (error) {
      logger.warn('leadStage.realtime.ticketFailed', { tenantId, ticketId, error });
    }
  }

  if (!result.changed) {
    return;
  }

  try {
    emitToTenant(tenantId, 'leads.updated', {
      tenantId,
      leadId: result.lead.id,
      contactId: result.lead.contactId,
      stage: result.stage,
      previousStage: result.previousStage,
      source,
      ticketIds: result.syncedTicketIds,
      lead: result.lead,
      leadActivity: result.activity,
    });
  } catch (error) {
    logger.warn('leadStage.realtime.leadFailed', { tenantId, leadId: result.lead.id, error });
  }
};

type LeadStageErrorBody = {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
};

/**
 * Responde erros de mudança de etapa no formato `{ success: false, error: { code, message } }`.
 * Devolve `false` quando o erro não é de etapa (o chamador deve relançar).
 */
export const sendLeadStageError = (res: Response, error: unknown): boolean => {
  const send = (status: number, body: LeadStageErrorBody) => {
    res.locals.errorCode = body.error.code;
    res.status(status).json(body);
    return true;
  };

  if (error instanceof InvalidLeadStageTransitionError) {
    return send(409, {
      success: false,
      error: {
        code: 'INVALID_STAGE_TRANSITION',
        message: describeInvalidTransition(error.from, error.to),
        details: { from: error.from, to: error.to },
      },
    });
  }

  if (error instanceof LeadStageConflictError) {
    return send(409, { success: false, error: { code: 'STAGE_CONFLICT', message: STAGE_CONFLICT_MESSAGE } });
  }

  if (error instanceof NotFoundError) {
    return send(404, { success: false, error: { code: 'NOT_FOUND', message: 'Lead não encontrado.' } });
  }

  return false;
};
