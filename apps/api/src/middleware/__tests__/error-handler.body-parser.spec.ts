import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { errorHandler } from '../error-handler';

const buildApp = () => {
  const app = express();
  app.use(express.json({ limit: '1kb' }));
  app.post('/echo', (req, res) => {
    res.json({ success: true, data: req.body });
  });
  app.use(errorHandler);
  return app;
};

describe('errorHandler — erros do body-parser', () => {
  it('responde 400 INVALID_JSON para JSON malformado (antes caía no ramo genérico e virava 500)', async () => {
    const response = await request(buildApp())
      .post('/echo')
      .set('content-type', 'application/json')
      .send('{"name": "Ana",');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: 'INVALID_JSON' });
  });

  it('responde 413 PAYLOAD_TOO_LARGE para corpo acima do limite', async () => {
    const response = await request(buildApp())
      .post('/echo')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(4096) }));

    expect(response.status).toBe(413);
    expect(response.body.error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('mantém o fluxo normal para JSON válido', async () => {
    const response = await request(buildApp()).post('/echo').send({ name: 'Ana' });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ name: 'Ana' });
  });
});
