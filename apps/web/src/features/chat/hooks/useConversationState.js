import { useMemo } from 'react';
import { format, isThisYear, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { resolveMessageKey } from '../utils/messageIdentity.js';
import { LEAD_STAGE_DEFINITIONS, parseLeadStage } from '@/features/crm/utils/lead-stage';

const asDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** "Hoje", "Ontem", "24 de novembro", "24 de novembro de 2025". */
export const getDayLabel = (date) => {
  if (!date) return 'Sem data';
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  if (isThisYear(date)) return format(date, "d 'de' MMMM", { locale: ptBR });
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
};

export const normaliseMessages = (pages) => {
  if (!pages) return [];
  const records = [];
  const seen = new Set();
  for (const page of pages) {
    if (!page || !Array.isArray(page.items)) continue;
    for (const message of page.items) {
      if (!message) continue;
      const key = resolveMessageKey(message);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      records.push(message);
    }
  }
  return records.sort((a, b) => {
    const left = asDate(a.createdAt)?.getTime() ?? 0;
    const right = asDate(b.createdAt)?.getTime() ?? 0;
    return left - right;
  });
};

const SALES_LABELS = {
  simulation: 'Simulação registrada',
  proposal: 'Proposta registrada',
  deal: 'Venda registrada',
};

const buildSalesEntries = (ticket) => {
  if (!Array.isArray(ticket?.salesTimeline)) return [];
  const entries = [];
  ticket.salesTimeline.forEach((event, index) => {
    if (!event) return;
    const createdAt = asDate(event.createdAt ?? event.date ?? event.timestamp ?? null);
    const rawType = typeof event.type === 'string' ? event.type : 'event';
    const [kind] = rawType.split('.');
    const basePayload =
      event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) ? { ...event.payload } : {};
    // Etapa do lead no momento do evento (valores antigos são normalizados para o funil único).
    const leadStage = parseLeadStage(event.stage ?? basePayload.stage ?? null);

    entries.push({
      id: event.id ? `sales-${event.id}` : `sales-${index}`,
      date: createdAt,
      type: kind || 'event',
      payload: {
        ...basePayload,
        label: basePayload.label ?? SALES_LABELS[kind] ?? 'Atualização de vendas',
        description: basePayload.description ?? basePayload.body ?? null,
        calculationSnapshot: basePayload.calculationSnapshot ?? null,
        stage: leadStage,
        stageLabel: leadStage ? LEAD_STAGE_DEFINITIONS[leadStage].label : null,
        eventType: rawType,
        actorId: event.actorId ?? null,
        metadata: event.metadata ?? basePayload.metadata ?? null,
      },
    });
  });
  return entries;
};

/**
 * Único construtor da linha do tempo da conversa: mensagens, notas internas e eventos
 * de vendas em ordem cronológica, com divisores de dia ("Hoje", "Ontem", "24 de novembro").
 */
export const buildConversationTimeline = ({ messages = [], ticket = null, notes = [] } = {}) => {
  const entries = [];

  messages.forEach((message, index) => {
    const canonicalKey =
      resolveMessageKey(message) ?? (message?.id ? String(message.id) : null) ?? `message-${index}`;
    entries.push({
      type: 'message',
      id: canonicalKey,
      date: asDate(message?.createdAt),
      payload: message,
    });
  });

  if (Array.isArray(notes)) {
    notes.forEach((note, index) => {
      if (!note) return;
      entries.push({
        type: 'note',
        id: `note-${note.id ?? index}`,
        date: asDate(note.createdAt ?? note.updatedAt ?? null),
        payload: note,
      });
    });
  }

  entries.push(...buildSalesEntries(ticket));

  // Ordenação estável: empate mantém a ordem de inserção.
  const sorted = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const left = a.entry.date ? a.entry.date.getTime() : 0;
      const right = b.entry.date ? b.entry.date.getTime() : 0;
      return left - right || a.index - b.index;
    })
    .map(({ entry }) => entry);

  const timeline = [];
  let currentDay;
  sorted.forEach((entry) => {
    const dayKey = entry.date ? format(entry.date, 'yyyy-MM-dd') : 'sem-data';
    if (dayKey !== currentDay) {
      currentDay = dayKey;
      timeline.push({
        type: 'divider',
        id: `divider-${dayKey}`,
        label: getDayLabel(entry.date),
        date: entry.date,
      });
    }
    timeline.push(entry);
  });

  return timeline;
};

const EMPTY = [];

export const useConversationState = ({ ticket, messagesPages, notes }) => {
  const messages = useMemo(() => normaliseMessages(messagesPages), [messagesPages]);
  const resolvedNotes = Array.isArray(notes) ? notes : EMPTY;

  const timeline = useMemo(
    () => buildConversationTimeline({ messages, ticket, notes: resolvedNotes }),
    [messages, ticket, resolvedNotes],
  );

  const statistics = useMemo(() => {
    const lastInbound = ticket?.timeline?.lastInboundAt ? asDate(ticket.timeline.lastInboundAt) : null;
    return {
      totalMessages: messages.length,
      lastInbound,
      window: ticket?.window ?? null,
    };
  }, [messages.length, ticket?.timeline, ticket?.window]);

  return {
    messages,
    timeline,
    statistics,
  };
};

export default useConversationState;
