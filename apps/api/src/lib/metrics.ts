const WEBHOOK_METRIC = 'whatsapp_webhook_events_total';
const WEBHOOK_HELP = '# HELP whatsapp_webhook_events_total Contador de eventos recebidos pelo webhook de WhatsApp';
const WEBHOOK_TYPE = '# TYPE whatsapp_webhook_events_total counter';

const OUTBOUND_TOTAL_METRIC = 'whatsapp_outbound_total';
const OUTBOUND_TOTAL_HELP = '# HELP whatsapp_outbound_total Contador de envios outbound por instância/status';
const OUTBOUND_TOTAL_TYPE = '# TYPE whatsapp_outbound_total counter';

const OUTBOUND_LATENCY_METRIC = 'whatsapp_outbound_latency_ms';
const OUTBOUND_LATENCY_HELP = '# HELP whatsapp_outbound_latency_ms Latência de envio outbound em milissegundos';
const OUTBOUND_LATENCY_TYPE = '# TYPE whatsapp_outbound_latency_ms summary';

type CounterLabels = Record<string, string | number | boolean | null | undefined>;

const webhookCounterStore = new Map<string, number>();
const outboundTotalStore = new Map<string, number>();
const outboundLatencyStore = new Map<string, { sum: number; count: number }>();

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

  return `${lines.join('\n')}\n`;
};

export const resetMetrics = (): void => {
  webhookCounterStore.clear();
  outboundTotalStore.clear();
  outboundLatencyStore.clear();
};
