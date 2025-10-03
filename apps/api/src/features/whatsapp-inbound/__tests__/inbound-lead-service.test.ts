import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  queueFindFirst: vi.fn(),
  contactFindUnique: vi.fn(),
  contactFindFirst: vi.fn(),
  contactUpdate: vi.fn(),
  contactCreate: vi.fn(),
  whatsappInstanceFindUnique: vi.fn(),
  campaignFindMany: vi.fn(),
}));

const queueFindFirst = prismaMocks.queueFindFirst;
const contactFindUnique = prismaMocks.contactFindUnique;
const contactFindFirst = prismaMocks.contactFindFirst;
const contactUpdate = prismaMocks.contactUpdate;
const contactCreate = prismaMocks.contactCreate;
const whatsappInstanceFindUnique = prismaMocks.whatsappInstanceFindUnique;
const campaignFindMany = prismaMocks.campaignFindMany;

vi.mock('../../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../lib/socket-registry', () => ({
  emitToTenant: vi.fn(),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    queue: { findFirst: prismaMocks.queueFindFirst },
    contact: {
      findUnique: prismaMocks.contactFindUnique,
      findFirst: prismaMocks.contactFindFirst,
      update: prismaMocks.contactUpdate,
      create: prismaMocks.contactCreate,
    },
    whatsAppInstance: {
      findUnique: prismaMocks.whatsAppInstanceFindUnique,
    },
    campaign: {
      findMany: prismaMocks.campaignFindMany,
    },
  },
}));

const allocationMocks = vi.hoisted(() => ({
  addAllocations: vi.fn(async () => ({ newlyAllocated: [] })),
}));

const addAllocations = allocationMocks.addAllocations;

vi.mock('../../../data/lead-allocation-store', () => ({
  addAllocations: allocationMocks.addAllocations,
}));

const ticketServiceMocks = vi.hoisted(() => ({
  createTicket: vi.fn(async () => ({ id: 'ticket-1' })),
  sendMessage: vi.fn(async () => ({})),
}));

const createTicket = ticketServiceMocks.createTicket;
const sendMessage = ticketServiceMocks.sendMessage;

vi.mock('../../../services/ticket-service', () => ({
  createTicket: ticketServiceMocks.createTicket,
  sendMessage: ticketServiceMocks.sendMessage,
}));

import { emitToTenant } from '../../../lib/socket-registry';
import { ingestInboundWhatsAppMessage } from '../services/inbound-lead-service';

const baseEvent = {
  id: 'evt-1',
  instanceId: 'instance-1',
  timestamp: new Date().toISOString(),
  contact: {
    phone: '+5511999999999',
    name: 'Contato Teste',
  },
  message: {
    id: 'msg-1',
    type: 'text',
    text: 'Olá mundo',
  },
  metadata: {},
};

describe('ingestInboundWhatsAppMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whatsappInstanceFindUnique.mockResolvedValue({
      id: 'instance-1',
      tenantId: 'tenant-1',
    });
    campaignFindMany.mockResolvedValue([
      {
        id: 'campaign-1',
        tenantId: 'tenant-1',
        agreementId: 'agreement-1',
        status: 'active',
      },
    ]);
    queueFindFirst.mockResolvedValue({ id: 'queue-1' });
    contactFindUnique.mockResolvedValue(null);
    contactFindFirst.mockResolvedValue(null);
    contactCreate.mockResolvedValue({
      id: 'contact-1',
      tenantId: 'tenant-1',
      name: 'Contato Teste',
      phone: '+5511999999999',
      document: '12345678900',
      tags: ['whatsapp'],
      customFields: {},
    });
  });

  it('garante contato, ticket e mensagem quando conjunto válido', async () => {
    await ingestInboundWhatsAppMessage(baseEvent);

    expect(contactCreate).toHaveBeenCalled();
    expect(createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', channel: 'WHATSAPP' })
    );
    expect(sendMessage).toHaveBeenCalledWith(
      'tenant-1',
      undefined,
      expect.objectContaining({ ticketId: 'ticket-1', content: expect.stringContaining('Olá') })
    );
    expect(emitToTenant).not.toHaveBeenCalled();
  });

  it('emite alerta quando fila não encontrada', async () => {
    queueFindFirst.mockResolvedValueOnce(null);

    await ingestInboundWhatsAppMessage(baseEvent);

    expect(emitToTenant).toHaveBeenCalledWith('tenant-1', 'whatsapp.queue.missing', expect.any(Object));
    expect(createTicket).not.toHaveBeenCalled();
  });
});
