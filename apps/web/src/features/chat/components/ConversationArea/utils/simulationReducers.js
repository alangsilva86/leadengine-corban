export const SELECTION_ACTIONS = {
  RESET: 'reset',
  TOGGLE: 'toggle',
  SYNC_WITH_OFFERS: 'sync-with-offers',
};

const normalizeSelectionEntry = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const offerId = typeof entry.offerId === 'string' ? entry.offerId.trim() : String(entry.offerId ?? '');
  const termId = typeof entry.termId === 'string' ? entry.termId.trim() : String(entry.termId ?? '');
  if (!offerId || !termId) {
    return null;
  }
  return { offerId, termId };
};

export const selectionReducer = (state, action) => {
  switch (action?.type) {
    case SELECTION_ACTIONS.RESET: {
      const payload = Array.isArray(action.payload) ? action.payload : [];
      return payload.map(normalizeSelectionEntry).filter(Boolean);
    }
    case SELECTION_ACTIONS.TOGGLE: {
      const entry = normalizeSelectionEntry(action.payload);
      if (!entry) {
        return state;
      }
      const exists = state.some((item) => item.offerId === entry.offerId && item.termId === entry.termId);
      const shouldSelect = action.payload?.checked ?? true;
      if (shouldSelect && !exists) {
        return [...state, entry];
      }
      if (!shouldSelect && exists) {
        return state.filter((item) => !(item.offerId === entry.offerId && item.termId === entry.termId));
      }
      return state;
    }
    case SELECTION_ACTIONS.SYNC_WITH_OFFERS: {
      const validKeys = action.payload?.validKeys instanceof Set ? action.payload.validKeys : new Set();
      const filtered = state.filter((entry) => validKeys.has(`${entry.offerId}::${entry.termId}`));
      if (filtered.length > 0 || !Array.isArray(action.payload?.fallbackSelection)) {
        return filtered;
      }
      return action.payload.fallbackSelection.map(normalizeSelectionEntry).filter(Boolean);
    }
    default:
      return state;
  }
};

export const createSelectionFallback = (offers) => {
  if (!Array.isArray(offers) || offers.length === 0) {
    return [];
  }
  return offers.flatMap((offer) => {
    const primary = offer?.terms?.[0];
    if (!offer?.id || !primary?.id) {
      return [];
    }
    return [{ offerId: offer.id, termId: primary.id }];
  });
};

export const QUEUE_ALERTS_ACTIONS = {
  SYNC: 'sync',
};

const normalizeQueueAlert = (entry, fallbackMessage, index) => {
  const payload = entry && typeof entry === 'object' ? entry.payload ?? {} : {};
  const message =
    payload && typeof payload.message === 'string' && payload.message.trim().length > 0
      ? payload.message.trim()
      : fallbackMessage;
  const reason =
    payload && typeof payload.reason === 'string' && payload.reason.trim().length > 0
      ? payload.reason.trim()
      : null;
  const instanceId =
    payload && typeof payload.instanceId === 'string' && payload.instanceId.trim().length > 0
      ? payload.instanceId.trim()
      : null;

  return {
    message,
    reason,
    instanceId,
    index,
  };
};

export const queueAlertsReducer = (state, action) => {
  switch (action?.type) {
    case QUEUE_ALERTS_ACTIONS.SYNC: {
      const alerts = Array.isArray(action.payload?.alerts) ? action.payload.alerts : [];
      const fallbackMessage =
        typeof action.payload?.fallbackMessage === 'string' && action.payload.fallbackMessage.trim().length > 0
          ? action.payload.fallbackMessage.trim()
          : 'Fila padrão indisponível.';
      return alerts.slice(0, 3).map((entry, index) => normalizeQueueAlert(entry, fallbackMessage, index));
    }
    default:
      return state;
  }
};
