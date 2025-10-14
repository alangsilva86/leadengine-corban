import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { whatsappWebhookRouter } from '../webhook-routes';
import { resetMetrics, renderMetrics } from '../../../../lib/metrics';
import { refreshWhatsAppEnv } from '../../../../config/whatsapp';

const ORIGINAL_ENV = {
  enforce: process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE,
  secret: process.env.WHATSAPP_WEBHOOK_HMAC_SECRET,
};

describe('WhatsApp webhook HMAC signature enforcement', () => {
  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = 'true';
    process.env.WHATSAPP_WEBHOOK_HMAC_SECRET = 'unit-secret';
    refreshWhatsAppEnv();
    resetMetrics();
  });

  const buildApp = () => {
    const app = express();
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
        },
      })
    );
    app.use('/api/webhooks', whatsappWebhookRouter);
    return app;
  };

  it('rejects requests without signature when enforcement is enabled', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/webhooks/whatsapp').send({ event: 'ping' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ ok: false, code: 'INVALID_SIGNATURE' });
    const metrics = renderMetrics();
    expect(metrics).toMatch(
      /whatsapp_webhook_events_total\{[^}]*reason="invalid_signature"[^}]*result="rejected"[^}]*\} 1/
    );
  });

  it('rejects requests with mismatching signature', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('x-signature-sha256', 'deadbeef')
      .send({ event: 'pong' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_SIGNATURE');
    const metrics = renderMetrics();
    expect(metrics).toMatch(
      /whatsapp_webhook_events_total\{[^}]*reason="invalid_signature"[^}]*result="rejected"[^}]*\} 1/
    );
  });

  it('accepts requests with valid signature', async () => {
    const app = buildApp();
    const payload = { event: 'ok' };
    const raw = JSON.stringify(payload);
    const crypto = await import('node:crypto');
    const signature = crypto.createHmac('sha256', 'unit-secret').update(raw).digest('hex');

    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('x-signature-sha256', signature)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true });
  });
});

if (ORIGINAL_ENV.enforce !== undefined) {
  process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = ORIGINAL_ENV.enforce;
} else {
  delete process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE;
}

if (ORIGINAL_ENV.secret !== undefined) {
  process.env.WHATSAPP_WEBHOOK_HMAC_SECRET = ORIGINAL_ENV.secret;
} else {
  delete process.env.WHATSAPP_WEBHOOK_HMAC_SECRET;
}
