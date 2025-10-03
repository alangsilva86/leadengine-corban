import client from 'prom-client';

const register = new client.Registry();
register.setDefaultLabels({ service: 'ticketz-api' });
client.collectDefaultMetrics({ register });

export const whatsappWebhookEventsCounter = new client.Counter({
  name: 'whatsapp_webhook_events_total',
  help: 'Quantidade de eventos recebidos pelo webhook de WhatsApp',
  labelNames: ['result', 'reason'],
  registers: [register],
});

export const getMetricsRegistry = () => register;
