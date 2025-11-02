import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, beforeEach, it, expect, vi } from 'vitest';

import type { AuthenticatedUser } from '../../middleware/auth';

type ConfigRecord = {
  id: string;
  tenantId: string;
  queueId: string | null;
  scopeKey: string;
  model: string;
  temperature: number;
  maxOutputTokens: number | null;
  systemPromptReply: string | null;
  systemPromptSuggest: string | null;
  structuredOutputSchema: unknown;
  tools: unknown;
  vectorStoreEnabled: boolean;
  vectorStoreIds: string[];
  streamingEnabled: boolean;
  defaultMode: 'IA_AUTO' | 'COPILOTO' | 'HUMANO';
  confidenceThreshold: number | null;
  fallbackPolicy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const configStore = new Map<string, ConfigRecord>();
const suggestionStore: Array<{ tenantId: string; conversationId: string; payload: unknown }> = [];
const memoryStore = new Map<string, any>();
const runStore: Array<{ tenantId: string; conversationId: string; runType: string }> = [];

const buildConfigKey = (tenantId: string, queueId: string | null) =>
  `${tenantId}:${queueId ?? '__global__'}`;

const resetStores = () => {
  configStore.clear();
  suggestionStore.length = 0;
  memoryStore.clear();
  runStore.length = 0;
};

vi.mock('@ticketz/storage', () => {
  return {
    getAiConfig: vi.fn(async (tenantId: string, queueId?: string | null) => {
      return configStore.get(buildConfigKey(tenantId, queueId ?? null)) ?? null;
    }),
    upsertAiConfig: vi.fn(async (input: any) => {
      const key = buildConfigKey(input.tenantId, input.queueId ?? null);
      const record: ConfigRecord = {
        id: input.id ?? `config-${randomUUID()}`,
        tenantId: input.tenantId,
        queueId: input.queueId ?? null,
        scopeKey: input.scopeKey ?? input.queueId ?? '__global__',
        model: input.model,
        temperature: input.temperature ?? 0.3,
        maxOutputTokens: input.maxOutputTokens ?? null,
        systemPromptReply: input.systemPromptReply ?? null,
        systemPromptSuggest: input.systemPromptSuggest ?? null,
        structuredOutputSchema: input.structuredOutputSchema ?? null,
        tools: input.tools ?? null,
        vectorStoreEnabled: input.vectorStoreEnabled ?? false,
        vectorStoreIds: input.vectorStoreIds ?? [],
        streamingEnabled: input.streamingEnabled ?? true,
        defaultMode: input.defaultMode ?? 'COPILOTO',
        confidenceThreshold: input.confidenceThreshold ?? null,
        fallbackPolicy: input.fallbackPolicy ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      configStore.set(key, record);
      return record;
    }),
    recordAiSuggestion: vi.fn(async (input: any) => {
      suggestionStore.push({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        payload: input.payload,
      });
      return {
        id: `suggestion-${randomUUID()}`,
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        payload: input.payload,
      };
    }),
    recordAiRun: vi.fn(async (input: any) => {
      runStore.push({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        runType: input.runType,
      });
      return {
        id: `run-${randomUUID()}`,
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        runType: input.runType,
      };
    }),
    upsertAiMemory: vi.fn(async (input: any) => {
      const key = `${input.tenantId}:${input.contactId}:${input.topic}`;
      const record = {
        id: `memory-${randomUUID()}`,
        tenantId: input.tenantId,
        contactId: input.contactId,
        topic: input.topic,
        content: input.content,
        metadata: input.metadata ?? null,
        expiresAt: input.expiresAt ?? null,
        updatedAt: new Date(),
      };
      memoryStore.set(key, record);
      return record;
    }),
  };
});

vi.mock('../../services/ai/tool-registry', () => ({
  getRegisteredTools: vi.fn(() => []),
  executeTool: vi.fn(async () => ({
    ok: false,
    error: 'Tool registry mock não configurado',
  })),
}));

const buildTestApp = async (options?: { aiEnabled?: boolean }) => {
  if (options?.aiEnabled) {
    process.env.OPENAI_API_KEY = 'test-key';
  } else {
    delete process.env.OPENAI_API_KEY;
  }

  vi.resetModules();
  const { aiRouter } = await import('../ai');

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
    resetStores();
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  it('returns default config when tenant has no record', async () => {
    const app = await buildTestApp();

    const response = await request(app).get('/ai/config');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      model: 'gpt-4o-mini',
      vectorStoreEnabled: false,
      streamingEnabled: true,
      defaultMode: 'COPILOTO',
    });
  });

  it('persists config updates', async () => {
    const app = await buildTestApp();

    const saveResponse = await request(app).put('/ai/config').send({
      model: 'gpt-4o',
      temperature: 0.7,
      maxOutputTokens: 1024,
      systemPromptReply: 'Responda com energia.',
      systemPromptSuggest: 'Resuma a conversa.',
      structuredOutputSchema: { type: 'object' },
      vectorStoreEnabled: true,
      vectorStoreIds: ['vs_123'],
      streamingEnabled: false,
      defaultMode: 'IA_AUTO',
      confidenceThreshold: 0.6,
      fallbackPolicy: 'fallback-to-human',
    });

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.data).toMatchObject({
      model: 'gpt-4o',
      defaultMode: 'IA_AUTO',
      streamingEnabled: false,
      vectorStoreIds: ['vs_123'],
    });
  });

  it('streams stub reply when OpenAI is disabled', async () => {
    const app = await buildTestApp();

    const response = await request(app)
      .post('/ai/reply')
      .send({
        conversationId: 'conv-1',
        messages: [{ role: 'user', content: 'Olá, IA!' }],
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('event: delta');
    expect(response.text).toContain('event: done');
  });

  it('streams OpenAI response when enabled', async () => {
    const originalFetch = global.fetch;
    const encoder = new TextEncoder();
    const events = [
      {
        type: 'response.output_text.delta',
        delta: { type: 'output_text.delta', text: 'Olá' },
      },
      {
        type: 'response.output_text.delta',
        delta: { type: 'output_text.delta', text: ' mundo' },
      },
      {
        type: 'response.completed',
        response: {
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'Olá mundo' }],
            },
          ],
        },
      },
    ];

    const fetchMock = vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    try {
      const app = await buildTestApp({ aiEnabled: true });

      const response = await request(app)
        .post('/ai/reply')
        .send({
          conversationId: 'conv-1',
          messages: [{ role: 'user', content: 'Olá, IA!' }],
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.text).toContain('data: {"delta":"Olá"}');
      expect(response.text).toContain('data: {"delta":" mundo"}');
      expect(response.text).toContain('event: done');
      expect(response.text).toContain('"status":"success"');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    }
  });

  it('returns and updates assistant mode', async () => {
    const app = await buildTestApp();

    const initialMode = await request(app).get('/ai/mode');
    expect(initialMode.body.data.mode).toBe('COPILOTO');

    const updateMode = await request(app).post('/ai/mode').send({ mode: 'HUMANO' });
    expect(updateMode.status).toBe(200);
    expect(updateMode.body.data.mode).toBe('HUMANO');

    const afterUpdate = await request(app).get('/ai/mode');
    expect(afterUpdate.body.data.mode).toBe('HUMANO');
  });

  it('returns structured suggestion stub when OpenAI is disabled', async () => {
    const app = await buildTestApp();

    const response = await request(app)
      .post('/ai/suggest')
      .send({
        conversationId: 'conv-123',
        goal: 'Recomendar próximos passos',
        lastMessages: [{ role: 'user', content: 'Qual o status da minha proposta?' }],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.suggestion).toMatchObject({
      next_step: expect.any(String),
      tips: expect.any(Array),
      confidence: 0,
    });
    expect(response.body.data.aiEnabled).toBe(false);
  });

  it('upserts AI memory entries', async () => {
    const app = await buildTestApp();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const response = await request(app)
      .post('/ai/memory/upsert')
      .send({
        contactId: 'contact-1',
        topic: 'contact:name',
        content: 'João da Silva',
        metadata: { source: 'ticket-1' },
        expiresAt,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      contactId: 'contact-1',
      topic: 'contact:name',
      content: 'João da Silva',
    });
  });
});
