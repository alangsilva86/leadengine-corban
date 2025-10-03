const METRIC_NAME = 'whatsapp_webhook_events_total';
const HELP = '# HELP whatsapp_webhook_events_total Contador de eventos recebidos pelo webhook de WhatsApp\n# TYPE whatsapp_webhook_events_total counter';

const counterStore = new Map<string, number>();

const serializeLabels = (labels) => {
  const entries = Object.entries(labels ?? {}).map(([key, value]) => `${key}="${value}"`);
  return entries.join(',');
};

export const whatsappWebhookEventsCounter = {
  inc(labels, value = 1) {
    const key = serializeLabels(labels);
    const current = counterStore.get(key) ?? 0;
    counterStore.set(key, current + value);
  },
};

export const renderMetrics = (): string => {
  const lines = [HELP];
  if (counterStore.size === 0) {
    lines.push(`${METRIC_NAME} 0`);
    return `${lines.join('\n')}\n`;
  }
  for (const [labelString, value] of counterStore.entries()) {
    const suffix = labelString ? `{${labelString}}` : '';
    lines.push(`${METRIC_NAME}${suffix} ${value}`);
  }
  return `${lines.join('\n')}\n`;
};
