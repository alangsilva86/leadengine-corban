const WEBHOOK_METRIC = 'whatsapp_webhook_events_total';
const WEBHOOK_HELP = '# HELP whatsapp_webhook_events_total Contador de eventos recebidos pelo webhook de WhatsApp';
const WEBHOOK_TYPE = '# TYPE whatsapp_webhook_events_total counter';

const OUTBOUND_TOTAL_METRIC = 'whatsapp_outbound_total';
const OUTBOUND_TOTAL_HELP = '# HELP whatsapp_outbound_total Contador de envios outbound por instância/status';
const OUTBOUND_TOTAL_TYPE = '# TYPE whatsapp_outbound_total counter';

const OUTBOUND_LATENCY_METRIC = 'whatsapp_outbound_latency_ms';
const OUTBOUND_LATENCY_HELP = '# HELP whatsapp_outbound_latency_ms Latência de envio outbound em milissegundos';
const OUTBOUND_LATENCY_TYPE = '# TYPE whatsapp_outbound_latency_ms summary';

const HTTP_REQUEST_METRIC = 'whatsapp_http_requests_total';
const HTTP_REQUEST_HELP = '# HELP whatsapp_http_requests_total Contador de requisições HTTP para APIs de WhatsApp';
const HTTP_REQUEST_TYPE = '# TYPE whatsapp_http_requests_total counter';

const WS_EMIT_METRIC = 'ws_emit_total';
const WS_EMIT_HELP = '# HELP ws_emit_total Contador de eventos emitidos via WebSocket/Socket.IO';
const WS_EMIT_TYPE = '# TYPE ws_emit_total counter';

type CounterLabels = Record<string, string | number | boolean | null | undefined>;

const webhookCounterStore = new Map<string, number>();
const outboundTotalStore = new Map<string, number>();
const outboundLatencyStore = new Map<string, { sum: number; count: number }>();
const httpRequestCounterStore = new Map<string, number>();
const wsEmitCounterStore = new Map<string, number>();

const serializeLabels = (labels: CounterLabels = {}): string => {
  const entries = Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}="${value}"`);
  return entries.join(',');
};

export const whatsappWebhookEventsCounter = {
  inc(labels: CounterLabels = {}, value = 1): void {
    const key = serializeLabels(labels);
    const current = webhookCounterStore.get(key) ?? 0;
    webhookCounterStore.set(key, current + value);
  },
};

export const whatsappOutboundMetrics = {
  incTotal(labels: CounterLabels = {}, value = 1): void {
    const key = serializeLabels(labels);
    const current = outboundTotalStore.get(key) ?? 0;
    outboundTotalStore.set(key, current + value);
  },
  observeLatency(labels: CounterLabels = {}, latencyMs: number): void {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) {
      return;
    }

    const key = serializeLabels(labels);
    const current = outboundLatencyStore.get(key) ?? { sum: 0, count: 0 };
    outboundLatencyStore.set(key, {
      sum: current.sum + latencyMs,
      count: current.count + 1,
    });
  },
};

export const whatsappHttpRequestsCounter = {
  inc(labels: CounterLabels = {}, value = 1): void {
    const key = serializeLabels(labels);
    const current = httpRequestCounterStore.get(key) ?? 0;
    httpRequestCounterStore.set(key, current + value);
  },
};

export const wsEmitCounter = {
  inc(labels: CounterLabels = {}, value = 1): void {
    const key = serializeLabels(labels);
    const current = wsEmitCounterStore.get(key) ?? 0;
    wsEmitCounterStore.set(key, current + value);
  },
};

export const renderMetrics = (): string => {
  const lines: string[] = [];

  lines.push(WEBHOOK_HELP, WEBHOOK_TYPE);
  if (webhookCounterStore.size === 0) {
    lines.push(`${WEBHOOK_METRIC} 0`);
  } else {
    for (const [labelString, value] of webhookCounterStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${WEBHOOK_METRIC}${suffix} ${value}`);
    }
  }

  lines.push(OUTBOUND_TOTAL_HELP, OUTBOUND_TOTAL_TYPE);
  if (outboundTotalStore.size === 0) {
    lines.push(`${OUTBOUND_TOTAL_METRIC} 0`);
  } else {
    for (const [labelString, value] of outboundTotalStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${OUTBOUND_TOTAL_METRIC}${suffix} ${value}`);
    }
  }

  lines.push(OUTBOUND_LATENCY_HELP, OUTBOUND_LATENCY_TYPE);
  if (outboundLatencyStore.size === 0) {
    lines.push(`${OUTBOUND_LATENCY_METRIC}_sum 0`);
    lines.push(`${OUTBOUND_LATENCY_METRIC}_count 0`);
  } else {
    for (const [labelString, stats] of outboundLatencyStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${OUTBOUND_LATENCY_METRIC}_sum${suffix} ${stats.sum}`);
      lines.push(`${OUTBOUND_LATENCY_METRIC}_count${suffix} ${stats.count}`);
    }
  }

  lines.push(HTTP_REQUEST_HELP, HTTP_REQUEST_TYPE);
  if (httpRequestCounterStore.size === 0) {
    lines.push(`${HTTP_REQUEST_METRIC} 0`);
  } else {
    for (const [labelString, value] of httpRequestCounterStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${HTTP_REQUEST_METRIC}${suffix} ${value}`);
    }
  }

  lines.push(WS_EMIT_HELP, WS_EMIT_TYPE);
  if (wsEmitCounterStore.size === 0) {
    lines.push(`${WS_EMIT_METRIC} 0`);
  } else {
    for (const [labelString, value] of wsEmitCounterStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${WS_EMIT_METRIC}${suffix} ${value}`);
    }
  }

  return `${lines.join('\n')}\n`;
};

export const resetMetrics = (): void => {
  webhookCounterStore.clear();
  outboundTotalStore.clear();
  outboundLatencyStore.clear();
  httpRequestCounterStore.clear();
  wsEmitCounterStore.clear();
};
