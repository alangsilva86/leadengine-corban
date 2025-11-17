import { Router } from 'express';
import { body } from 'express-validator';
import { SalesStage } from '@ticketz/core';

import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { asyncHandler } from '../middleware/error-handler';
import {
  createTicketSalesDeal,
  createTicketSalesProposal,
  getSalesSimulationFilters,
  simulateTicketSales,
} from '../services/ticket-service';
import { resolveRequestTenantId } from '../services/tenant-service';

const router = Router();

const allowedStages = Object.values(SalesStage);

const stageValidator = body('stage')
  .optional({ values: 'falsy' })
  .isString()
  .trim()
  .isIn(allowedStages)
  .withMessage('Estágio de vendas inválido.');

const metadataValidator = body('metadata')
  .optional({ values: 'falsy' })
  .isObject()
  .withMessage('Metadata deve ser um objeto.');

router.get(
  '/config/simulation-filters',
  requireTenant,
  asyncHandler(async (_req, res) => {
    const config = getSalesSimulationFilters();

    res.json({
      success: true,
      data: config,
    });
  })
);

router.post(
  '/simulate',
  requireTenant,
  body('ticketId').isString().trim().notEmpty(),
  body('calculationSnapshot').isObject().withMessage('Snapshot de cálculo é obrigatório.'),
  body('leadId').optional({ values: 'falsy' }).isString(),
  stageValidator,
  metadataValidator,
  validateRequest,
  asyncHandler(async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const result = await simulateTicketSales({
      tenantId,
      ticketId: req.body.ticketId,
      calculationSnapshot: req.body.calculationSnapshot,
      leadId: req.body.leadId ?? null,
      stage: typeof req.body.stage === 'string' ? (req.body.stage as SalesStage) : null,
      metadata: req.body.metadata ?? null,
      actorId: req.user?.id ?? null,
    });

    res.status(201).json({
      success: true,
      data: {
        simulation: result.entity,
        ticket: result.ticket,
        event: result.event,
      },
    });
  })
);

router.post(
  '/proposals',
  requireTenant,
  body('ticketId').isString().trim().notEmpty(),
  body('calculationSnapshot').isObject().withMessage('Snapshot de cálculo é obrigatório.'),
  body('leadId').optional({ values: 'falsy' }).isString(),
  body('simulationId').optional({ values: 'falsy' }).isString(),
  stageValidator,
  metadataValidator,
  validateRequest,
  asyncHandler(async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const result = await createTicketSalesProposal({
      tenantId,
      ticketId: req.body.ticketId,
      calculationSnapshot: req.body.calculationSnapshot,
      leadId: req.body.leadId ?? null,
      simulationId: req.body.simulationId ?? null,
      stage: typeof req.body.stage === 'string' ? (req.body.stage as SalesStage) : null,
      metadata: req.body.metadata ?? null,
      actorId: req.user?.id ?? null,
    });

    res.status(201).json({
      success: true,
      data: {
        proposal: result.entity,
        ticket: result.ticket,
        event: result.event,
      },
    });
  })
);

router.post(
  '/deals',
  requireTenant,
  body('ticketId').isString().trim().notEmpty(),
  body('calculationSnapshot').isObject().withMessage('Snapshot de cálculo é obrigatório.'),
  body('leadId').optional({ values: 'falsy' }).isString(),
  body('simulationId').optional({ values: 'falsy' }).isString(),
  body('proposalId').optional({ values: 'falsy' }).isString(),
  body('closedAt').optional({ values: 'falsy' }).isISO8601(),
  stageValidator,
  metadataValidator,
  validateRequest,
  asyncHandler(async (req, res) => {
    const tenantId = resolveRequestTenantId(req);
    const result = await createTicketSalesDeal({
      tenantId,
      ticketId: req.body.ticketId,
      calculationSnapshot: req.body.calculationSnapshot,
      leadId: req.body.leadId ?? null,
      simulationId: req.body.simulationId ?? null,
      proposalId: req.body.proposalId ?? null,
      closedAt: req.body.closedAt ?? null,
      stage: typeof req.body.stage === 'string' ? (req.body.stage as SalesStage) : null,
      metadata: req.body.metadata ?? null,
      actorId: req.user?.id ?? null,
    });

    res.status(201).json({
      success: true,
      data: {
        deal: result.entity,
        ticket: result.ticket,
        event: result.event,
      },
    });
  })
);

export const salesRouter = router;
