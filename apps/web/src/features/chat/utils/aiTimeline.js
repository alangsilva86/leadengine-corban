const MAX_AI_TIMELINE_ITEMS = 50;

const limitTimelineEntries = (timeline, limit = MAX_AI_TIMELINE_ITEMS) => {
  if (!Array.isArray(timeline) || limit <= 0) {
    return [];
  }
  const startIndex = Math.max(timeline.length - limit, 0);
  return timeline.slice(startIndex);
};

const extractEntryPayload = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const { payload } = entry;
  if (payload && typeof payload === 'object') {
    return payload;
  }
  return entry;
};

export const getTimelineEntryContent = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return (
    payload.content ??
    payload.text ??
    payload.body ??
    payload.message ??
    payload.messageText ??
    null
  );
};

export const parseMessageRole = (value) => {
  if (!value) return 'user';
  const normalized = String(value).trim().toLowerCase();
  if (['assistant', 'agent', 'outbound', 'auto'].includes(normalized)) {
    return 'assistant';
  }
  if (['system'].includes(normalized)) {
    return 'system';
  }
  return 'user';
};

export const buildAiContextTimeline = (timeline) => {
  const slice = limitTimelineEntries(timeline);
  return slice
    .map((entry) => {
      const payload = extractEntryPayload(entry);
      if (!payload || typeof payload !== 'object') {
        return null;
      }
      const content = getTimelineEntryContent(payload) ?? '';
      const role = payload.role ?? payload.direction ?? payload.authorRole ?? null;
      return {
        content,
        role,
      };
    })
    .filter(Boolean);
};

export const buildAiMessagesPayload = (timeline) => {
  const slice = limitTimelineEntries(timeline);
  return slice
    .map((entry) => {
      if (!entry) return null;
      const payload = extractEntryPayload(entry);
      if (!payload || typeof payload !== 'object') {
        return null;
      }
      const content = getTimelineEntryContent(payload);
      if (!content || typeof content !== 'string') {
        return null;
      }
      const role = parseMessageRole(payload.role ?? payload.direction ?? payload.authorRole);
      return {
        role,
        content,
      };
    })
    .filter(Boolean);
};

export const sanitizeAiTimeline = (timeline) => {
  const slice = limitTimelineEntries(timeline);
  return slice.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry ?? null;
    }

    const payload = entry.payload && typeof entry.payload === 'object' ? entry.payload : null;
    const content = getTimelineEntryContent(payload);

    return {
      id: entry.id ?? null,
      type: entry.type ?? payload?.type ?? payload?.messageType ?? null,
      timestamp: entry.timestamp ?? payload?.timestamp ?? payload?.createdAt ?? null,
      payload: payload
        ? {
            id: payload.id ?? null,
            direction: payload.direction ?? payload.metadata?.direction ?? null,
            author:
              payload.author ??
              payload.userName ??
              payload.agentName ??
              payload.contact?.name ??
              payload.metadata?.contactName ??
              null,
            role: payload.role ?? payload.direction ?? null,
            content: content ?? null,
            channel: payload.channel ?? payload.metadata?.channel ?? null,
            attachments: Array.isArray(payload.attachments) ? payload.attachments : undefined,
          }
        : entry.payload ?? entry,
    };
  });
};

export { MAX_AI_TIMELINE_ITEMS };
