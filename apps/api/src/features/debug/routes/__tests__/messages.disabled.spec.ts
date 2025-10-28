import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { buildDisabledDebugMessagesRouter } from '../messages';

describe('buildDisabledDebugMessagesRouter', () => {
  it('responds with helpful payload when WhatsApp debug feature is disabled', async () => {
    const app = express();
    app.use(buildDisabledDebugMessagesRouter());

    const response = await request(app).get('/debug/baileys-events?limit=10');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'WHATSAPP_DEBUG_DISABLED',
      },
    });
    expect(response.body.error.message).toContain('desativadas');
    expect(response.body.error.path).toBe('/debug/baileys-events?limit=10');
  });
});
