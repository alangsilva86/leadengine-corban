import express from 'express';
import request from 'supertest';
import { describe, beforeEach, it, expect } from 'vitest';

import { aiRouter } from '../ai';
import { resetAiStores } from '../../data/ai-store';
import type { AuthenticatedUser } from '../../middleware/auth';

const buildTestApp = () => {
  const app = express();
  app.use(express.json());

  const user: AuthenticatedUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'user@example.com',
    name: 'User Test',
    role: 'ADMIN',
    isActive: true,
    permissions: [],
  };

  app.use((req, _res, next) => {
    req.user = user;
    next();
  });

  app.use('/ai', aiRouter);
  return app;
};

describe('AI routes', () => {
  beforeEach(() => {
    resetAiStores();
  });

  it('returns the current AI mode', async () => {
    const app = buildTestApp();

    const response = await request(app).get('/ai/mode');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { mode: 'assist' },
    });
  });

  it('updates the AI mode', async () => {
    const app = buildTestApp();

    const response = await request(app)
      .post('/ai/mode')
      .send({ mode: 'auto' });

    expect(response.status).toBe(200);
    expect(response.body.data.mode).toBe('auto');
  });

  it('generates an AI reply using the default mode', async () => {
    const app = buildTestApp();

    const response = await request(app)
      .post('/ai/reply')
      .send({
        ticketId: 'ticket-1',
        contactId: 'contact-1',
        prompt: 'Resuma o andamento da proposta.',
        conversation: [
          { role: 'user', content: 'Olá, gostaria de saber sobre o status da minha proposta.' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toMatchObject({
      role: 'assistant',
      content: expect.stringContaining('próximos passos'),
    });
    expect(response.body.data.usage.totalTokens).toBeGreaterThan(0);
  });

  it('provides AI suggestions', async () => {
    const app = buildTestApp();

    const response = await request(app)
      .post('/ai/suggest')
      .send({
        ticketId: 'ticket-1',
        contactId: 'contact-1',
        conversation: [],
        limit: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.suggestions).toHaveLength(2);
  });

  it('upserts AI memory entries', async () => {
    const app = buildTestApp();

    const response = await request(app)
      .post('/ai/memory/upsert')
      .send({
        contactId: 'contact-1',
        topic: 'contact:name',
        content: 'João da Silva',
        ttlSeconds: 60,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      contactId: 'contact-1',
      topic: 'contact:name',
      content: 'João da Silva',
    });
  });
});
