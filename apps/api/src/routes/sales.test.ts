import express, { type Request } from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesStage } from '@ticketz/core';

vi.mock('@ticketz/storage', () => import('../test-utils/storage-mock'));

vi.mock('../middleware/auth', () => ({
  requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { salesRouter } from './sales';
import { ticketsRouter } from './tickets';
import { errorHandler } from '../middleware/error-handler';
import { registerSocketServer, type SocketServerAdapter } from '../lib/socket-registry';
import { createTicket, resetTicketStore } from '@ticketz/storage';
import { resetTicketSalesEventStore, listTicketSalesEvents } from '../data/ticket-sales-event-store';
import { renderMetrics, resetMetrics } from '../lib/metrics';
import {
  getSalesFunnelForDimension,
  getSalesFunnelSummary,
  resetSalesFunnelAggregations,
} from '../data/sales-funnel-aggregator';
import { logger } from '../config/logger';

class MockSocketServer {
  public events: Array<{ room: string; event: string; payload: unknown }> = [];

  to(room: string) {
    return {
      emit: (event: string, payload: unknown) => {
        this.events.push({ room, event, payload });
      },
    };
  }
}

const startTestServer = async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as Request).user = {
      id: 'user-1',
      tenantId: 'tenant-123',
      email: 'agent@example.com',
      name: 'Agent Smith',
      role: 'AGENT',
      isActive: true,
      permissions: ['tickets:read', 'tickets:write'],
    } as Request['user'];
    next();
  });
  app.use('/api/sales', salesRouter);
  app.use('/api/tickets', ticketsRouter);
  app.use(errorHandler);

  return new Promise<{ server: Server; url: string }>((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
};

const stopTestServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

describe('Sales routes', () => {
  let mockSocket: MockSocketServer;

  beforeEach(async () => {
    mockSocket = new MockSocketServer();
    registerSocketServer(mockSocket as unknown as SocketServerAdapter);
    await resetTicketStore();
    resetTicketSalesEventStore();
    resetMetrics();
    resetSalesFunnelAggregations();
  });

  afterEach(() => {
    registerSocketServer(null);
    vi.restoreAllMocks();
  });

  it('creates a sales simulation and synchronizes timeline with tickets', async () => {
    const { server, url } = await startTestServer();

    try {
      const infoSpy = vi.spyOn(logger, 'info');
      const ticket = await createTicket({
        tenantId: 'tenant-123',
        contactId: 'contact-1',
        queueId: 'queue-1',
        channel: 'WHATSAPP',
        metadata: {},
      });

      const response = await fetch(`${url}/api/sales/simulate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          calculationSnapshot: { monthly: 500 },
          stage: SalesStage.QUALIFICACAO,
        }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.simulation.ticketId).toBe(ticket.id);
      expect(body.data.ticket.stage).toBe(SalesStage.QUALIFICACAO);
      expect(body.data.event.type).toBe('simulation.created');

      const emittedEvents = mockSocket.events.map((entry) => entry.event);
      expect(emittedEvents).toContain('tickets.updated');
      expect(emittedEvents).toContain('tickets.sales.timeline');

      const timeline = await listTicketSalesEvents('tenant-123', ticket.id);
      expect(timeline).toHaveLength(1);
      expect(timeline[0].stage).toBe(SalesStage.QUALIFICACAO);

      const metricsSnapshot = await renderMetrics();
      expect(metricsSnapshot).toMatch(
        /sales_simulation_total\{[^}]*stage="QUALIFICACAO"[^}]*tenantId="tenant-123"/
      );
      expect(metricsSnapshot).toMatch(
        /sales_funnel_stage_total\{[^}]*dimension="agreement"[^}]*stage="QUALIFICACAO"/
      );

      const agreementFunnel = getSalesFunnelForDimension('tenant-123', 'agreement', 'unknown');
      expect(agreementFunnel?.operations.simulation).toBe(1);
      expect(agreementFunnel?.stages).toEqual([
        expect.objectContaining({
          stage: SalesStage.QUALIFICACAO,
          simulation: 1,
          total: 1,
        }),
      ]);

      const summary = getSalesFunnelSummary('tenant-123');
      expect(summary?.operations.simulation).toBe(1);

      expect(infoSpy).toHaveBeenCalledWith(
        'sales.operation.simulation',
        expect.objectContaining({
          tenantId: 'tenant-123',
          ticketId: ticket.id,
          operation: 'simulation',
          simulationId: expect.any(String),
        })
      );

      const listResponse = await fetch(`${url}/api/tickets`, {
        headers: { 'content-type': 'application/json' },
      });
      expect(listResponse.status).toBe(200);
      const listBody = await listResponse.json();
      expect(Array.isArray(listBody.data.items)).toBe(true);
      expect(listBody.data.items[0].salesTimeline).toHaveLength(1);
      expect(listBody.data.items[0].salesTimeline[0].type).toBe('simulation.created');
    } finally {
      await stopTestServer(server);
    }
  });

  it('rejects simulation requests when tenant header mismatches authenticated context', async () => {
    const { server, url } = await startTestServer();

    try {
      const response = await fetch(`${url}/api/sales/simulate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-other',
        },
        body: JSON.stringify({
          ticketId: 'ticket-1',
          calculationSnapshot: { monthly: 400 },
        }),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    } finally {
      await stopTestServer(server);
    }
  });

  it('creates a proposal with calculation snapshot', async () => {
    const { server, url } = await startTestServer();

    try {
      const infoSpy = vi.spyOn(logger, 'info');
      const ticket = await createTicket({
        tenantId: 'tenant-123',
        contactId: 'contact-2',
        queueId: 'queue-1',
        channel: 'WHATSAPP',
        metadata: {},
      });

      const simulationResponse = await fetch(`${url}/api/sales/simulate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          calculationSnapshot: { baseValue: 1000 },
          stage: SalesStage.QUALIFICACAO,
        }),
      });
      const simulationBody = await simulationResponse.json();
      const simulationId = simulationBody.data.simulation.id as string;

      const response = await fetch(`${url}/api/sales/proposals`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          simulationId,
          calculationSnapshot: { total: 1500, installments: 12 },
          stage: SalesStage.PROPOSTA,
        }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.proposal.simulationId).toBe(simulationId);
      expect(body.data.proposal.calculationSnapshot.total).toBe(1500);
      expect(body.data.event.type).toBe('proposal.created');
      expect(body.data.ticket.stage).toBe(SalesStage.PROPOSTA);

      const metricsSnapshot = await renderMetrics();
      expect(metricsSnapshot).toMatch(
        /sales_proposal_total\{[^}]*stage="PROPOSTA"[^}]*tenantId="tenant-123"/
      );

      const funnel = getSalesFunnelForDimension('tenant-123', 'agreement', 'unknown');
      expect(funnel?.operations.proposal).toBeGreaterThanOrEqual(1);
      expect(funnel?.stages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            stage: SalesStage.PROPOSTA,
            proposal: expect.any(Number),
          }),
        ])
      );

      expect(infoSpy).toHaveBeenCalledWith(
        'sales.operation.proposal',
        expect.objectContaining({
          tenantId: 'tenant-123',
          ticketId: ticket.id,
          operation: 'proposal',
          proposalId: expect.any(String),
          simulationId,
        })
      );
    } finally {
      await stopTestServer(server);
    }
  });

  it('rejects deal creation with invalid stage transition', async () => {
    const { server, url } = await startTestServer();

    try {
      const ticket = await createTicket({
        tenantId: 'tenant-123',
        contactId: 'contact-3',
        queueId: 'queue-1',
        channel: 'WHATSAPP',
        metadata: {},
        stage: SalesStage.PROPOSTA,
      });

      const response = await fetch(`${url}/api/sales/deals`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          calculationSnapshot: { approved: true },
          stage: SalesStage.APROVADO_LIQUIDACAO,
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('Transição');
    } finally {
      await stopTestServer(server);
    }
  });
});
