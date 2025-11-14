import { useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { resolveMessageKey } from '../utils/messageIdentity.js';
import {
  formatStageLabel,
  getLegacyStageValue,
  getStageValue,
  normalizeStage as normalizeSalesStage,
} from '../components/ConversationArea/utils/stage.js';

const asDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const DAY_FORMAT = "dd 'de' MMM";

const getDayLabel = (date) => {
  if (!date) return 'Hoje';
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, DAY_FORMAT);
};

const normaliseMessages = (pages) => {
  if (!pages) return [];
  const records = [];
  for (const page of pages) {
    if (!page || !Array.isArray(page.items)) continue;
    for (const message of page.items) {
      records.push(message);
    }
  }
  return records.sort((a, b) => {
    const left = asDate(a.createdAt)?.getTime() ?? 0;
    const right = asDate(b.createdAt)?.getTime() ?? 0;
    return left - right;
  });
};

const buildTimeline = ({ messages, ticket, notes }) => {
  const grouped = [];
  let currentDay = null;

  const pushDivider = (date) => {
    grouped.push({
      type: 'divider',
      id: `divider-${date?.toISOString?.() ?? 'unknown'}`,
      label: getDayLabel(date),
      date,
    });
  };

  const ensureDivider = (date) => {
    if (!date) {
      if (currentDay === null) {
        pushDivider(null);
        currentDay = null;
      }
      return;
    }
    const dayKey = format(date, 'yyyy-MM-dd');
    if (currentDay !== dayKey) {
      pushDivider(date);
      currentDay = dayKey;
    }
  };

  const timeline = [];

  messages.forEach((message, index) => {
    const createdAt = asDate(message.createdAt);
    ensureDivider(createdAt);
    const canonicalKey =
      resolveMessageKey(message) ??
      (typeof message.externalId === 'string' && message.externalId.trim().length > 0
        ? message.externalId.trim()
        : null) ??
      (message.id ? String(message.id) : null) ??
      `message-${index}`;
    timeline.push({
      type: 'message',
      id: canonicalKey,
      date: createdAt,
      payload: message,
    });
  });

  const events = [];
  const leadEvents = [];
  const salesEvents = [];

  if (ticket?.timeline) {
    const { firstInboundAt, firstOutboundAt } = ticket.timeline;
    if (firstInboundAt) {
      events.push({
        id: 'event-first-inbound',
        date: asDate(firstInboundAt),
        label: 'Primeira mensagem do cliente',
      });
    }
    if (firstOutboundAt) {
      events.push({
        id: 'event-first-outbound',
        date: asDate(firstOutboundAt),
        label: 'Primeira resposta enviada',
      });
    }
  }

  if (Array.isArray(notes) && notes.length > 0) {
    for (const note of notes) {
      leadEvents.push({
        id: `note-${note.id}`,
        date: asDate(note.createdAt ?? note.updatedAt ?? Date.now()),
        type: 'note',
        payload: note,
      });
    }
  }

  if (Array.isArray(ticket?.salesTimeline)) {
    ticket.salesTimeline.forEach((event, index) => {
      if (!event) {
        return;
      }

      const createdAt = asDate(event.createdAt ?? event.date ?? event.timestamp ?? null);
      const rawType = typeof event.type === 'string' ? event.type : 'event';
      const [kind] = rawType.split('.');
      const normalizedStage = normalizeSalesStage(event.stage ?? event.payload?.stage ?? null);
      const stageLabel = normalizedStage !== 'DESCONHECIDO' ? formatStageLabel(normalizedStage) : null;
      const stageValue =
        normalizedStage !== 'DESCONHECIDO'
          ? getStageValue(normalizedStage)
          : null;
      const legacyStageValue =
        normalizedStage !== 'DESCONHECIDO'
          ? getLegacyStageValue(normalizedStage)
          : null;
      const basePayload =
        event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
          ? { ...event.payload }
          : {};

      const labelMap = {
        simulation: 'Simulação registrada',
        proposal: 'Proposta registrada',
        deal: 'Negócio registrado',
      };

      const entryLabel = labelMap[kind] ?? 'Atualização de vendas';

      salesEvents.push({
        id: event.id ? `sales-${event.id}` : `sales-${index}`,
        date: createdAt,
        type: kind,
        payload: {
          ...basePayload,
          label: basePayload.label ?? entryLabel,
          description: basePayload.description ?? basePayload.body ?? null,
          calculationSnapshot: basePayload.calculationSnapshot ?? null,
          stageKey: normalizedStage !== 'DESCONHECIDO' ? normalizedStage : null,
          stageLabel,
          stageValue,
          legacyStageValue,
          eventType: rawType,
          actorId: event.actorId ?? null,
          metadata: event.metadata ?? null,
        },
      });
    });
  }

  const combinedEvents = [...events, ...leadEvents, ...salesEvents].sort((a, b) => {
    const left = asDate(a.date)?.getTime() ?? 0;
    const right = asDate(b.date)?.getTime() ?? 0;
    return left - right;
  });

  combinedEvents.forEach((entry) => {
    const date = asDate(entry.date);
    ensureDivider(date);
    timeline.push({
      type:
        entry.type === 'note'
          ? 'note'
          : entry.type === 'simulation' || entry.type === 'proposal' || entry.type === 'deal'
            ? entry.type
            : 'event',
      id: entry.id,
      date,
      payload: entry.payload ?? entry,
    });
  });

  return timeline.sort((a, b) => {
    const left = a.date ? a.date.getTime() : 0;
    const right = b.date ? b.date.getTime() : 0;
    return left - right;
  });
};

export const useConversationState = ({ ticket, messagesPages, notes }) => {
  const messages = useMemo(() => normaliseMessages(messagesPages), [messagesPages]);

  const timeline = useMemo(
    () => buildTimeline({ messages, ticket, notes }),
    [messages, ticket, notes]
  );

  const statistics = useMemo(() => {
    const totalMessages = messages.length;
    const lastInbound = ticket?.timeline?.lastInboundAt ? asDate(ticket.timeline.lastInboundAt) : null;
    const window = ticket?.window ?? null;

    return {
      totalMessages,
      lastInbound,
      window,
    };
  }, [messages.length, ticket?.timeline, ticket?.window]);

  return {
    messages,
    timeline,
    statistics,
  };
};

export default useConversationState;
