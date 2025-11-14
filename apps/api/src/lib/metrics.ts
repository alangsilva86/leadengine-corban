const WEBHOOK_METRIC = 'whatsapp_webhook_events_total';
const WEBHOOK_HELP = '# HELP whatsapp_webhook_events_total Contador de eventos recebidos pelo webhook de WhatsApp';
const WEBHOOK_TYPE = '# TYPE whatsapp_webhook_events_total counter';

const OUTBOUND_TOTAL_METRIC = 'whatsapp_outbound_total';
const OUTBOUND_TOTAL_HELP = '# HELP whatsapp_outbound_total Contador de envios outbound por instância/status';
const OUTBOUND_TOTAL_TYPE = '# TYPE whatsapp_outbound_total counter';

const OUTBOUND_LATENCY_METRIC = 'whatsapp_outbound_latency_ms';
const OUTBOUND_LATENCY_HELP = '# HELP whatsapp_outbound_latency_ms Latência de envio outbound em milissegundos';
const OUTBOUND_LATENCY_TYPE = '# TYPE whatsapp_outbound_latency_ms summary';

const OUTBOUND_DELIVERY_SUCCESS_METRIC = 'whatsapp_outbound_delivery_success_total';
const OUTBOUND_DELIVERY_SUCCESS_HELP =
  '# HELP whatsapp_outbound_delivery_success_total Contador de mensagens outbound com entrega confirmada por tipo';
const OUTBOUND_DELIVERY_SUCCESS_TYPE = '# TYPE whatsapp_outbound_delivery_success_total counter';

const SOCKET_RECONNECT_METRIC = 'whatsapp_socket_reconnects_total';
const SOCKET_RECONNECT_HELP =
  '# HELP whatsapp_socket_reconnects_total Contador de tentativas de reconexão do socket do WhatsApp';
const SOCKET_RECONNECT_TYPE = '# TYPE whatsapp_socket_reconnects_total counter';

const HTTP_REQUEST_METRIC = 'whatsapp_http_requests_total';
const HTTP_REQUEST_HELP = '# HELP whatsapp_http_requests_total Contador de requisições HTTP para APIs de WhatsApp';
const HTTP_REQUEST_TYPE = '# TYPE whatsapp_http_requests_total counter';

const WS_EMIT_METRIC = 'ws_emit_total';
const WS_EMIT_HELP = '# HELP ws_emit_total Contador de eventos emitidos via WebSocket/Socket.IO';
const WS_EMIT_TYPE = '# TYPE ws_emit_total counter';

const INBOUND_MESSAGES_METRIC = 'inbound_messages_processed_total';
const INBOUND_MESSAGES_HELP =
  '# HELP inbound_messages_processed_total Contador de mensagens inbound processadas por tenant';
const INBOUND_MESSAGES_TYPE = '# TYPE inbound_messages_processed_total counter';

const INBOUND_LATENCY_METRIC = 'whatsapp_inbound_latency_ms';
const INBOUND_LATENCY_HELP = '# HELP whatsapp_inbound_latency_ms Latência de processamento inbound em milissegundos';
const INBOUND_LATENCY_TYPE = '# TYPE whatsapp_inbound_latency_ms summary';

const INBOUND_MEDIA_RETRY_ATTEMPTS_METRIC = 'inbound_media_retry_attempts_total';
const INBOUND_MEDIA_RETRY_ATTEMPTS_HELP =
  '# HELP inbound_media_retry_attempts_total Tentativas de reprocessamento de mídia inbound';
const INBOUND_MEDIA_RETRY_ATTEMPTS_TYPE = '# TYPE inbound_media_retry_attempts_total counter';

const INBOUND_MEDIA_RETRY_SUCCESS_METRIC = 'inbound_media_retry_success_total';
const INBOUND_MEDIA_RETRY_SUCCESS_HELP =
  '# HELP inbound_media_retry_success_total Reprocessamentos de mídia inbound bem-sucedidos';
const INBOUND_MEDIA_RETRY_SUCCESS_TYPE = '# TYPE inbound_media_retry_success_total counter';

const INBOUND_MEDIA_RETRY_DLQ_METRIC = 'inbound_media_retry_dlq_total';
const INBOUND_MEDIA_RETRY_DLQ_HELP =
  '# HELP inbound_media_retry_dlq_total Jobs de mídia inbound enviados para DLQ após esgotar tentativas';
const INBOUND_MEDIA_RETRY_DLQ_TYPE = '# TYPE inbound_media_retry_dlq_total counter';

const SALES_OPERATIONS_METRIC = 'sales_operations_total';
const SALES_OPERATIONS_HELP =
  '# HELP sales_operations_total Contador de operações do serviço de vendas por estágio e tipo';
const SALES_OPERATIONS_TYPE = '# TYPE sales_operations_total counter';

const LEAD_LAST_CONTACT_METRIC = 'lead_last_contact_timestamp';
const LEAD_LAST_CONTACT_HELP =
  '# HELP lead_last_contact_timestamp Timestamp (epoch ms) do último contato inbound por lead';
const LEAD_LAST_CONTACT_TYPE = '# TYPE lead_last_contact_timestamp gauge';

type CounterLabels = Record<string, string | number | boolean | null | undefined>;

type LabelConstraint = {
  limit: number;
  defaultValue?: string;
};

type MetricConstraints = Record<string, LabelConstraint>;

const ORIGIN_CONSTRAINT: LabelConstraint = { limit: 20, defaultValue: 'unknown' };
const TENANT_CONSTRAINT: LabelConstraint = { limit: 100, defaultValue: 'unknown' };
const INSTANCE_CONSTRAINT: LabelConstraint = { limit: 200, defaultValue: 'unknown' };
const TRANSPORT_CONSTRAINT: LabelConstraint = { limit: 10, defaultValue: 'unknown' };
const OPERATION_CONSTRAINT: LabelConstraint = { limit: 20, defaultValue: 'unknown' };
const STAGE_CONSTRAINT: LabelConstraint = { limit: 50, defaultValue: 'desconhecido' };

const BASE_LABEL_CONSTRAINTS: MetricConstraints = {
  origin: ORIGIN_CONSTRAINT,
  tenantId: TENANT_CONSTRAINT,
  instanceId: INSTANCE_CONSTRAINT,
};

const LABEL_CONSTRAINTS_WITH_TRANSPORT: MetricConstraints = {
  ...BASE_LABEL_CONSTRAINTS,
  transport: TRANSPORT_CONSTRAINT,
  transportMode: TRANSPORT_CONSTRAINT,
};

const METRIC_CONSTRAINTS: Record<string, MetricConstraints> = {
  [WEBHOOK_METRIC]: BASE_LABEL_CONSTRAINTS,
  [OUTBOUND_TOTAL_METRIC]: BASE_LABEL_CONSTRAINTS,
  [OUTBOUND_LATENCY_METRIC]: BASE_LABEL_CONSTRAINTS,
  [INBOUND_LATENCY_METRIC]: BASE_LABEL_CONSTRAINTS,
  [OUTBOUND_DELIVERY_SUCCESS_METRIC]: BASE_LABEL_CONSTRAINTS,
  [SOCKET_RECONNECT_METRIC]: BASE_LABEL_CONSTRAINTS,
  [INBOUND_MESSAGES_METRIC]: BASE_LABEL_CONSTRAINTS,
  [INBOUND_MEDIA_RETRY_ATTEMPTS_METRIC]: BASE_LABEL_CONSTRAINTS,
  [INBOUND_MEDIA_RETRY_SUCCESS_METRIC]: BASE_LABEL_CONSTRAINTS,
  [INBOUND_MEDIA_RETRY_DLQ_METRIC]: BASE_LABEL_CONSTRAINTS,
  [SALES_OPERATIONS_METRIC]: {
    ...BASE_LABEL_CONSTRAINTS,
    operation: OPERATION_CONSTRAINT,
    stage: STAGE_CONSTRAINT,
  },
};

const labelValueTracker = new Map<string, Map<string, Set<string>>>();

const webhookCounterStore = new Map<string, number>();
const outboundTotalStore = new Map<string, number>();
const outboundLatencyStore = new Map<string, { sum: number; count: number }>();
const inboundLatencyStore = new Map<string, { sum: number; count: number }>();
const outboundDeliverySuccessStore = new Map<string, number>();
const socketReconnectCounterStore = new Map<string, number>();
const httpRequestCounterStore = new Map<string, number>();
const wsEmitCounterStore = new Map<string, number>();
const inboundMessagesCounterStore = new Map<string, number>();
const inboundMediaRetryAttemptsStore = new Map<string, number>();
const inboundMediaRetrySuccessStore = new Map<string, number>();
const inboundMediaRetryDlqStore = new Map<string, number>();
const salesOperationsCounterStore = new Map<string, number>();
const leadLastContactGaugeStore = new Map<string, number>();

const toLabelString = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  const serialized = String(value);
  return serialized.length > 0 ? serialized : null;
};

const getLabelValueSet = (metric: string, label: string): Set<string> => {
  let registry = labelValueTracker.get(metric);
  if (!registry) {
    registry = new Map<string, Set<string>>();
    labelValueTracker.set(metric, registry);
  }

  let values = registry.get(label);
  if (!values) {
    values = new Set<string>();
    registry.set(label, values);
  }

  return values;
};

const enforceCardinalityLimit = (
  metric: string,
  label: string,
  value: string,
  constraint: LabelConstraint
): string => {
  const limit = Math.max(constraint.limit, 0);
  if (limit === 0) {
    return 'overflow';
  }

  const values = getLabelValueSet(metric, label);
  if (values.has(value)) {
    return value;
  }

  if (values.size >= limit) {
    return 'overflow';
  }

  values.add(value);
  return value;
};

const applyMetricConstraints = (metric: string, labels: CounterLabels = {}): Record<string, string> => {
  const normalized: Record<string, string> = {};
  const constraints = METRIC_CONSTRAINTS[metric];

  if (constraints) {
    for (const [label, constraint] of Object.entries(constraints)) {
      const rawValue = labels[label];
      const candidate = toLabelString(rawValue);
      const fallback = constraint.defaultValue ?? 'unknown';
      const prepared = enforceCardinalityLimit(metric, label, candidate ?? fallback, constraint);
      normalized[label] = prepared;
    }
  }

  for (const [key, value] of Object.entries(labels)) {
    if (constraints && Object.prototype.hasOwnProperty.call(constraints, key)) {
      continue;
    }

    const candidate = toLabelString(value);
    if (candidate !== null) {
      normalized[key] = candidate;
    }
  }

  return normalized;
};

const serializeLabels = (labels: Record<string, string>): string => {
  const entries = Object.entries(labels);
  if (entries.length === 0) {
    return '';
  }

  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}="${value}"`)
    .join(',');
};

const buildLabelKey = (metric: string, labels: CounterLabels = {}): string => {
  const normalized = applyMetricConstraints(metric, labels);
  return serializeLabels(normalized);
};

export const whatsappWebhookEventsCounter = {
  inc(labels: CounterLabels = {}, value = 1): void {
    const key = buildLabelKey(WEBHOOK_METRIC, labels);
    const current = webhookCounterStore.get(key) ?? 0;
    webhookCounterStore.set(key, current + value);
  },
};

export const whatsappOutboundMetrics = {
  incTotal(labels: CounterLabels = {}, value = 1): void {
    const key = buildLabelKey(OUTBOUND_TOTAL_METRIC, labels);
    const current = outboundTotalStore.get(key) ?? 0;
    outboundTotalStore.set(key, current + value);
  },
  observeLatency(labels: CounterLabels = {}, latencyMs: number): void {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) {
      return;
    }

    const key = buildLabelKey(OUTBOUND_LATENCY_METRIC, labels);
    const current = outboundLatencyStore.get(key) ?? { sum: 0, count: 0 };
    outboundLatencyStore.set(key, {
      sum: current.sum + latencyMs,
      count: current.count + 1,
    });
  },
};

export const whatsappOutboundDeliverySuccessCounter = {
  inc(labels: CounterLabels = {}, value = 1): void {
    const key = buildLabelKey(OUTBOUND_DELIVERY_SUCCESS_METRIC, labels);
    const current = outboundDeliverySuccessStore.get(key) ?? 0;
    outboundDeliverySuccessStore.set(key, current + value);
  },
};

export const whatsappSocketReconnectsCounter = {
  inc(labels: CounterLabels = {}, value = 1): void {
    const key = buildLabelKey(SOCKET_RECONNECT_METRIC, labels);
    const current = socketReconnectCounterStore.get(key) ?? 0;
    socketReconnectCounterStore.set(key, current + value);
  },
};

export const whatsappHttpRequestsCounter = {
  inc(labels: CounterLabels = {}, value = 1): void {
    const key = buildLabelKey(HTTP_REQUEST_METRIC, labels);
    const current = httpRequestCounterStore.get(key) ?? 0;
    httpRequestCounterStore.set(key, current + value);
  },
};

export const wsEmitCounter = {
  inc(labels: CounterLabels = {}, value = 1): void {
    const key = buildLabelKey(WS_EMIT_METRIC, labels);
    const current = wsEmitCounterStore.get(key) ?? 0;
    wsEmitCounterStore.set(key, current + value);
  },
};

export const inboundMessagesProcessedCounter = {
  inc(labels: CounterLabels = {}, value = 1): void {
    const key = buildLabelKey(INBOUND_MESSAGES_METRIC, labels);
    const current = inboundMessagesCounterStore.get(key) ?? 0;
    inboundMessagesCounterStore.set(key, current + value);
  },
};

export const whatsappInboundMetrics = {
  observeLatency(labels: CounterLabels = {}, latencyMs: number): void {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) {
      return;
    }

    const key = buildLabelKey(INBOUND_LATENCY_METRIC, labels);
    const current = inboundLatencyStore.get(key) ?? { sum: 0, count: 0 };
    inboundLatencyStore.set(key, {
      sum: current.sum + latencyMs,
      count: current.count + 1,
    });
  },
};

const buildCounter = (metric: string, store: Map<string, number>) => ({
  inc(labels: CounterLabels = {}, value = 1): void {
    const key = buildLabelKey(metric, labels);
    const current = store.get(key) ?? 0;
    store.set(key, current + value);
  },
});

export const inboundMediaRetryAttemptsCounter = buildCounter(
  INBOUND_MEDIA_RETRY_ATTEMPTS_METRIC,
  inboundMediaRetryAttemptsStore
);

export const inboundMediaRetrySuccessCounter = buildCounter(
  INBOUND_MEDIA_RETRY_SUCCESS_METRIC,
  inboundMediaRetrySuccessStore
);

export const inboundMediaRetryDlqCounter = buildCounter(
  INBOUND_MEDIA_RETRY_DLQ_METRIC,
  inboundMediaRetryDlqStore
);

export const salesOperationsCounter = buildCounter(
  SALES_OPERATIONS_METRIC,
  salesOperationsCounterStore
);

export const leadLastContactGauge = {
  set(labels: CounterLabels = {}, timestampMs: number): void {
    if (!Number.isFinite(timestampMs)) {
      return;
    }

    const key = buildLabelKey(LEAD_LAST_CONTACT_METRIC, labels);
    leadLastContactGaugeStore.set(key, timestampMs);
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

  lines.push(OUTBOUND_DELIVERY_SUCCESS_HELP, OUTBOUND_DELIVERY_SUCCESS_TYPE);
  if (outboundDeliverySuccessStore.size === 0) {
    lines.push(`${OUTBOUND_DELIVERY_SUCCESS_METRIC} 0`);
  } else {
    for (const [labelString, value] of outboundDeliverySuccessStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${OUTBOUND_DELIVERY_SUCCESS_METRIC}${suffix} ${value}`);
    }
  }

  lines.push(SOCKET_RECONNECT_HELP, SOCKET_RECONNECT_TYPE);
  if (socketReconnectCounterStore.size === 0) {
    lines.push(`${SOCKET_RECONNECT_METRIC} 0`);
  } else {
    for (const [labelString, value] of socketReconnectCounterStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${SOCKET_RECONNECT_METRIC}${suffix} ${value}`);
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

  lines.push(SALES_OPERATIONS_HELP, SALES_OPERATIONS_TYPE);
  if (salesOperationsCounterStore.size === 0) {
    lines.push(`${SALES_OPERATIONS_METRIC} 0`);
  } else {
    for (const [labelString, value] of salesOperationsCounterStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${SALES_OPERATIONS_METRIC}${suffix} ${value}`);
    }
  }

  lines.push(INBOUND_MESSAGES_HELP, INBOUND_MESSAGES_TYPE);
  if (inboundMessagesCounterStore.size === 0) {
    lines.push(`${INBOUND_MESSAGES_METRIC} 0`);
  } else {
    for (const [labelString, value] of inboundMessagesCounterStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${INBOUND_MESSAGES_METRIC}${suffix} ${value}`);
    }
  }

  lines.push(INBOUND_LATENCY_HELP, INBOUND_LATENCY_TYPE);
  if (inboundLatencyStore.size === 0) {
    lines.push(`${INBOUND_LATENCY_METRIC}_sum 0`);
    lines.push(`${INBOUND_LATENCY_METRIC}_count 0`);
  } else {
    for (const [labelString, stats] of inboundLatencyStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${INBOUND_LATENCY_METRIC}_sum${suffix} ${stats.sum}`);
      lines.push(`${INBOUND_LATENCY_METRIC}_count${suffix} ${stats.count}`);
    }
  }

  lines.push(INBOUND_MEDIA_RETRY_ATTEMPTS_HELP, INBOUND_MEDIA_RETRY_ATTEMPTS_TYPE);
  if (inboundMediaRetryAttemptsStore.size === 0) {
    lines.push(`${INBOUND_MEDIA_RETRY_ATTEMPTS_METRIC} 0`);
  } else {
    for (const [labelString, value] of inboundMediaRetryAttemptsStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${INBOUND_MEDIA_RETRY_ATTEMPTS_METRIC}${suffix} ${value}`);
    }
  }

  lines.push(INBOUND_MEDIA_RETRY_SUCCESS_HELP, INBOUND_MEDIA_RETRY_SUCCESS_TYPE);
  if (inboundMediaRetrySuccessStore.size === 0) {
    lines.push(`${INBOUND_MEDIA_RETRY_SUCCESS_METRIC} 0`);
  } else {
    for (const [labelString, value] of inboundMediaRetrySuccessStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${INBOUND_MEDIA_RETRY_SUCCESS_METRIC}${suffix} ${value}`);
    }
  }

  lines.push(INBOUND_MEDIA_RETRY_DLQ_HELP, INBOUND_MEDIA_RETRY_DLQ_TYPE);
  if (inboundMediaRetryDlqStore.size === 0) {
    lines.push(`${INBOUND_MEDIA_RETRY_DLQ_METRIC} 0`);
  } else {
    for (const [labelString, value] of inboundMediaRetryDlqStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${INBOUND_MEDIA_RETRY_DLQ_METRIC}${suffix} ${value}`);
    }
  }

  lines.push(LEAD_LAST_CONTACT_HELP, LEAD_LAST_CONTACT_TYPE);
  if (leadLastContactGaugeStore.size === 0) {
    lines.push(`${LEAD_LAST_CONTACT_METRIC} 0`);
  } else {
    for (const [labelString, value] of leadLastContactGaugeStore.entries()) {
      const suffix = labelString ? `{${labelString}}` : '';
      lines.push(`${LEAD_LAST_CONTACT_METRIC}${suffix} ${value}`);
    }
  }

  return `${lines.join('\n')}\n`;
};

export const resetMetrics = (): void => {
  webhookCounterStore.clear();
  outboundTotalStore.clear();
  outboundLatencyStore.clear();
  inboundLatencyStore.clear();
  outboundDeliverySuccessStore.clear();
  socketReconnectCounterStore.clear();
  httpRequestCounterStore.clear();
  wsEmitCounterStore.clear();
  inboundMessagesCounterStore.clear();
  inboundMediaRetryAttemptsStore.clear();
  inboundMediaRetrySuccessStore.clear();
  inboundMediaRetryDlqStore.clear();
  salesOperationsCounterStore.clear();
  leadLastContactGaugeStore.clear();
  labelValueTracker.clear();
};
