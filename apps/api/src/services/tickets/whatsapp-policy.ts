import { ConflictError, NotFoundError } from '@ticketz/core';
import { prisma } from '../../lib/prisma';

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The pilot permits replies in a verified service window. Campaigns need a homologated template path. */
export const assertWhatsAppSendAllowed = async ({ tenantId, ticketId, contactId, instanceId }: {
  tenantId: string; ticketId: string; contactId: string; instanceId: string | null;
}) => {
  if (!instanceId) throw new ConflictError('Selecione uma instância WhatsApp para enviar.');
  const now = Date.now();
  const [contact, instance, inbound] = await Promise.all([
    prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { isBlocked: true } }),
    prisma.whatsAppInstance.findFirst({ where: { id: instanceId, tenantId }, select: { id: true } }),
    prisma.message.findFirst({ where: {
      tenantId, ticketId, contactId, instanceId, direction: 'INBOUND',
      externalId: { not: null },
      createdAt: { gt: new Date(now - SERVICE_WINDOW_MS) },
      AND: [
        { metadata: { path: ['normalizedTimestamp'], gt: now - SERVICE_WINDOW_MS } },
        { metadata: { path: ['normalizedTimestamp'], lte: now } },
      ],
    }, select: { id: true } }),
  ]);
  if (!contact) throw new NotFoundError('Contact', contactId);
  if (!instance) throw new NotFoundError('WhatsAppInstance', instanceId);
  if (contact.isBlocked) throw new ConflictError('O contato está bloqueado para comunicação.');
  if (!inbound) throw new ConflictError('A janela de atendimento do WhatsApp está fechada.');
};
