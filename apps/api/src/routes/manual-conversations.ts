import { Router, type Request, type Response } from 'express';
import { body } from 'express-validator';
import { LeadSource, LeadStatus, Prisma } from '@prisma/client';
import { ConflictError, ValidationError } from '@ticketz/core';

import { asyncHandler } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { requireTenant } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { normalizePhoneNumber, PhoneNormalizationError } from '../utils/phone';
import {
  createTicket,
  getTicketById,
  getDefaultQueueIdForTenant,
  sendMessage,
} from '../services/ticket-service';
import { ensureTenantRecord } from '../services/tenant-service';

const router: Router = Router();

const requestValidation = [
  body('phone').isString().trim().notEmpty().withMessage('Informe o telefone do contato.'),
  body('message')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Digite a mensagem inicial da conversa.'),
];

router.post(
  '/',
  requestValidation,
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;

    await ensureTenantRecord(tenantId, {
      route: 'manual-conversations.create',
      requestId: req.rid ?? null,
      userId,
    });

    const rawPhone = String(req.body.phone ?? '');
    const rawMessage = String(req.body.message ?? '');

    let digits: string;
    try {
      ({ digits } = normalizePhoneNumber(rawPhone));
    } catch (error) {
      const message =
        error instanceof PhoneNormalizationError
          ? error.message
          : 'Informe um telefone válido para iniciar a conversa.';
      throw new ValidationError(message);
    }

    const message = rawMessage.trim();
    if (!message) {
      throw new ValidationError('Digite a mensagem inicial da conversa.');
    }

    const defaultContactName = `Contato ${digits}`;

    let contact = await prisma.contact.findUnique({
      where: {
        tenantId_phone: {
          tenantId,
          phone: digits,
        },
      },
    });

    if (!contact) {
      try {
        contact = await prisma.contact.create({
          data: {
            tenantId,
            name: defaultContactName,
            phone: digits,
            tags: ['manual', 'whatsapp'],
            customFields: {
              source: 'manual_conversation',
            },
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          contact = await prisma.contact.findUnique({
            where: {
              tenantId_phone: {
                tenantId,
                phone: digits,
              },
            },
          });
        } else {
          throw error;
        }
      }
    }

    if (!contact) {
      throw new ValidationError('Não foi possível localizar ou criar o contato.');
    }

    let lead = await prisma.lead.create({
      data: {
        tenantId,
        contactId: contact.id,
        source: LeadSource.WHATSAPP,
        status: LeadStatus.NEW,
        notes: message,
      },
      include: {
        contact: true,
        campaign: true,
        assignee: true,
      },
    }).catch(async (error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingLead = await prisma.lead.findUnique({
          where: {
            tenantId_contactId: {
              tenantId,
              contactId: contact.id,
            },
          },
          include: {
            contact: true,
            campaign: true,
            assignee: true,
          },
        });

        if (existingLead) {
          const hasNotes = typeof existingLead.notes === 'string' && existingLead.notes.trim().length > 0;

          if (!hasNotes) {
            return prisma.lead.update({
              where: {
                tenantId_contactId: {
                  tenantId,
                  contactId: contact.id,
                },
              },
              data: {
                notes: message,
              },
              include: {
                contact: true,
                campaign: true,
                assignee: true,
              },
            });
          }

          return existingLead;
        }
      }

      throw error;
    });

    if (!lead) {
      throw new ValidationError('Não foi possível localizar ou criar o lead.');
    }

    const queueId = await getDefaultQueueIdForTenant(tenantId);

    const ticketSubject = contact.name || contact.phone || defaultContactName;

    let ticket: Awaited<ReturnType<typeof getTicketById>> | Awaited<ReturnType<typeof createTicket>> | null = null;
    try {
      ticket = await createTicket({
        tenantId,
        contactId: contact.id,
        queueId,
        subject: ticketSubject,
        channel: 'WHATSAPP',
        priority: 'NORMAL',
        metadata: {
          source: 'manual_conversation',
          leadId: lead.id,
        },
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        const existingTicketId =
          typeof error.details?.existingTicketId === 'string' ? error.details.existingTicketId : null;
        if (existingTicketId) {
          ticket = await getTicketById(tenantId, existingTicketId);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    if (!ticket) {
      throw new ValidationError('Não foi possível criar o ticket para esta conversa.');
    }

    const messageRecord = await sendMessage(tenantId, userId, {
      ticketId: ticket.id,
      content: message,
      direction: 'OUTBOUND',
      type: 'TEXT',
      metadata: {
        origin: 'manual_conversation',
      },
    });

    res.status(201).json({
      success: true,
      data: {
        contact,
        lead,
        ticket,
        messageRecord,
        phone: digits,
        message,
      },
    });
  })
);

export { router as manualConversationsRouter };
