export const emitInboxTelemetry = (event, payload = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  const detail = {
    scope: 'chat',
    event,
    timestamp: Date.now(),
    ...payload,
  };

  try {
    window.dispatchEvent(new CustomEvent('leadengine:inbox-telemetry', { detail }));
  } catch (error) {
    console.warn('Failed to emit inbox telemetry', { event, payload, error });
  }

  const analytics = window.analytics;
  if (analytics && typeof analytics.track === 'function') {
    try {
      analytics.track(event, detail);
    } catch (error) {
      console.warn('Analytics tracking failed', { event, detail, error });
    }
  }
};

export default emitInboxTelemetry;
