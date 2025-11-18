import { logger } from '../../../config/logger';
import { prisma } from '../../../lib/prisma';
import type { TicketNote } from '../../../data/ticket-note-store';
import { listTicketNotes } from '../../../data/ticket-note-store';
import type { Ticket, TicketHydrated, TicketLeadSummary, TicketContactSummary } from '../types';
import type { ConversationComputation } from '../shared/metrics';
import { fetchConversationStatsForTickets } from '../shared/metrics';

export const safeResolveContacts = async (
  tenantId: string,
  contactIds: string[]
): Promise<Map<string, TicketContactSummary>> => {
  if (contactIds.length === 0) {
    return new Map();
  }

  try {
    const records = await prisma.contact.findMany({
      where: {
        tenantId,
        id: { in: contactIds },
      },
    });

    return new Map(
      records.map((contact) => {
        const consent =
          contact.customFields && typeof contact.customFields === 'object' && 'consent' in contact.customFields
            ? ((contact.customFields as Record<string, unknown>).consent ?? null)
            : null;

        const normalizedConsent =
          consent && typeof consent === 'object'
            ? {
                granted: Boolean((consent as { granted?: unknown }).granted ?? false),
                base: (consent as { base?: unknown }).base ? String((consent as { base?: unknown }).base) : null,
                grantedAt:
                  (consent as { grantedAt?: unknown }).grantedAt &&
                  typeof (consent as { grantedAt?: unknown }).grantedAt === 'string'
                    ? new Date(String((consent as { grantedAt?: unknown }).grantedAt))
                    : null,
              }
            : null;

        const fullName = typeof contact.fullName === 'string' && contact.fullName.trim().length > 0 ? contact.fullName.trim() : null;
        const displayName =
          typeof contact.displayName === 'string' && contact.displayName.trim().length > 0 ? contact.displayName.trim() : null;
        const composedName = [contact.firstName, contact.lastName]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim())
          .join(' ');
        const fallbackName = composedName.length > 0 ? composedName : null;

        const summary: TicketContactSummary = {
          id: contact.id,
          name: fullName ?? displayName ?? fallbackName ?? 'Contato',
          phone: typeof contact.primaryPhone === 'string' && contact.primaryPhone.trim().length > 0 ? contact.primaryPhone.trim() : null,
          email: typeof contact.primaryEmail === 'string' && contact.primaryEmail.trim().length > 0 ? contact.primaryEmail.trim() : null,
          document: contact.document ?? null,
          avatar: contact.avatar ?? null,
          consent: normalizedConsent,
        };

        return [contact.id, summary] as const;
      })
    );
  } catch (error) {
    logger.warn('ticketService.resolveContacts.failed', {
      tenantId,
      contactIds,
      error,
    });
    return new Map();
  }
};

export const safeResolveLeads = async (
  tenantId: string,
  contactIds: string[]
): Promise<Map<string, TicketLeadSummary>> => {
  if (contactIds.length === 0) {
    return new Map();
  }

  try {
    const records = await prisma.lead.findMany({
      where: {
        tenantId,
        contactId: { in: contactIds },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const leadByContact = new Map<string, TicketLeadSummary>();
    for (const record of records) {
      if (leadByContact.has(record.contactId)) {
        continue;
      }

      leadByContact.set(record.contactId, {
        id: record.id,
        status: record.status,
        value: record.value ?? undefined,
        probability: record.probability ?? undefined,
        source: record.source,
        tags: record.tags ?? [],
        expectedCloseDate: record.expectedCloseDate ?? null,
        lastContactAt: record.lastContactAt ?? null,
        nextFollowUpAt: record.nextFollowUpAt ?? null,
        qualityRating:
          typeof record.customFields === 'object' && record.customFields !== null && 'qualityRating' in record.customFields
            ? Number((record.customFields as Record<string, unknown>).qualityRating)
            : null,
      });
    }

    return leadByContact;
  } catch (error) {
    logger.warn('ticketService.resolveLeads.failed', {
      tenantId,
      contactIds,
      error,
    });
    return new Map();
  }
};

export const resolveTicketNotes = async (
  tenantId: string,
  tickets: Ticket[]
): Promise<Map<string, TicketNote[]>> => {
  const entries = await Promise.all(
    tickets.map(async (ticket) => {
      const notes = await listTicketNotes(tenantId, ticket.id);
      return [ticket.id, notes] as const;
    })
  );

  return new Map(entries);
};

export const hydrateTicket = (
  ticket: Ticket,
  stats: ConversationComputation | undefined,
  salesTimeline: TicketHydrated['salesTimeline'],
  includeContact: boolean,
  includeLead: boolean,
  includeNotes: boolean,
  contacts: Map<string, TicketContactSummary>,
  leads: Map<string, TicketLeadSummary>,
  notes: Map<string, TicketNote[]>
): TicketHydrated => {
  const pipelineStep = typeof ticket.metadata?.pipelineStep === 'string' ? ticket.metadata.pipelineStep : ticket.stage ?? null;
  const qualityScore = stats && stats.totalMessages > 0 ? Math.round(((stats.totalMessages - stats.failedCount) / stats.totalMessages) * 100) : null;

  const hydrated: TicketHydrated = {
    ...ticket,
    pipelineStep,
    qualityScore,
    ...(stats?.window ? { window: stats.window } : {}),
    ...(stats?.timeline ? { timeline: stats.timeline } : {}),
    salesTimeline: salesTimeline ?? [],
  };

  if (includeContact) {
    hydrated.contact = contacts.get(ticket.contactId) ?? null;
  }

  if (includeLead) {
    hydrated.lead = leads.get(ticket.contactId) ?? null;
  }

  if (includeNotes) {
    hydrated.notes = notes.get(ticket.id) ?? [];
  }

  return hydrated;
};

export const resolveTicketHydrations = async (
  tenantId: string,
  tickets: Ticket[],
  include: { contact: boolean; lead: boolean; notes: boolean; metrics: boolean }
): Promise<{
  conversations: Map<string, ConversationComputation>;
  contacts: Map<string, TicketContactSummary>;
  leads: Map<string, TicketLeadSummary>;
  notes: Map<string, TicketNote[]>;
}> => {
  const conversations = await fetchConversationStatsForTickets(tenantId, tickets);
  const contactIds: string[] = Array.from(new Set(tickets.map((ticket) => ticket.contactId)));

  const [contacts, leads, notes] = await Promise.all([
    include.contact ? safeResolveContacts(tenantId, contactIds) : Promise.resolve(new Map()),
    include.lead || include.metrics ? safeResolveLeads(tenantId, contactIds) : Promise.resolve(new Map()),
    include.notes ? resolveTicketNotes(tenantId, tickets) : Promise.resolve(new Map()),
  ]);

  return { conversations, contacts, leads, notes };
};
