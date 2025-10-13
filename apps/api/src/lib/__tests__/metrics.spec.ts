import { beforeEach, describe, expect, it } from 'vitest';

import {
  inboundMessagesProcessedCounter,
  renderMetrics,
  resetMetrics,
  whatsappOutboundDeliverySuccessCounter,
  whatsappOutboundMetrics,
  whatsappSocketReconnectsCounter,
  whatsappWebhookEventsCounter,
} from '../metrics';

describe('metrics collectors', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('enforces cardinality limits for high churn labels', () => {
    for (let index = 0; index < 110; index += 1) {
      whatsappWebhookEventsCounter.inc({
        transport: 'http',
        origin: 'webhook',
        tenantId: `tenant-${index}`,
        instanceId: 'inst-shared',
        result: 'accepted',
        reason: 'load-test',
      });
    }

    const snapshot = renderMetrics();
    expect(snapshot).toContain('tenantId="tenant-0"');
    expect(snapshot).toContain('tenantId="overflow"');
    expect(snapshot).not.toContain('tenantId="tenant-109"');
  });

  it('fills default base labels when they are not provided', () => {
    whatsappOutboundMetrics.incTotal({ status: 'SENT' });
    inboundMessagesProcessedCounter.inc();

    const snapshot = renderMetrics();
    expect(snapshot).toContain(
      'whatsapp_outbound_total{instanceId="unknown",origin="unknown",status="SENT",tenantId="unknown",transport="unknown"} 1'
    );
    expect(snapshot).toContain(
      'inbound_messages_processed_total{instanceId="unknown",origin="unknown",tenantId="unknown",transport="unknown"} 1'
    );
  });

  it('exposes counters for delivery success and socket reconnections', () => {
    whatsappOutboundDeliverySuccessCounter.inc({
      transport: 'http',
      origin: 'ticket-service',
      tenantId: 'tenant-metrics',
      instanceId: 'inst-42',
      status: 'DELIVERED',
      messageType: 'text',
    });

    whatsappSocketReconnectsCounter.inc({
      transport: 'http',
      origin: 'ticket-service',
      tenantId: 'tenant-metrics',
      instanceId: 'inst-42',
      reason: 'INSTANCE_NOT_CONNECTED',
    });

    const snapshot = renderMetrics();
    expect(snapshot).toContain(
      'whatsapp_outbound_delivery_success_total{instanceId="inst-42",messageType="text",origin="ticket-service",status="DELIVERED",tenantId="tenant-metrics",transport="http"} 1'
    );
    expect(snapshot).toContain(
      'whatsapp_socket_reconnects_total{instanceId="inst-42",origin="ticket-service",reason="INSTANCE_NOT_CONNECTED",tenantId="tenant-metrics",transport="http"} 1'
    );
  });
});
