const emitAgreementsTelemetry = (
  event: string,
  payload: Record<string, unknown> = {}
) => {
  try {
    if (typeof window === 'undefined') {
      return;
    }

    window.dispatchEvent(new CustomEvent('leadengine:agreements-telemetry', { detail: { event, payload } }));
  } catch (error) {
    console.warn('agreements telemetry dispatch failed', { event, payload, error });
  }
};

export default emitAgreementsTelemetry;
