import { describe, expect, it } from 'vitest';
import { aiConfig as envAiConfig } from '../../config/ai';
import {
  DEFAULT_MODE,
  buildConfigUpsertPayload,
  defaultSuggestionSchema,
  modeToFrontend,
  normalizeModeFromFrontend,
  type AiConfigRecord,
} from './config-helpers';

const buildExistingConfig = (overrides: Record<string, unknown> = {}): AiConfigRecord => {
  const base = {
    id: 'cfg-1',
    tenantId: 'tenant-123',
    queueId: null,
    scopeKey: '__global__',
    model: 'gpt-4o',
    temperature: 0.55,
    maxOutputTokens: 512,
    systemPromptReply: 'Seja cordial.',
    systemPromptSuggest: 'Envie sugestões resumidas.',
    structuredOutputSchema: { type: 'object' },
    tools: { items: [] },
    vectorStoreEnabled: true,
    vectorStoreIds: ['vs_existing'],
    streamingEnabled: false,
    defaultMode: 'HUMANO',
    confidenceThreshold: 0.4,
    fallbackPolicy: 'human-first',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  } satisfies Record<string, unknown>;

  return { ...base, ...overrides } as AiConfigRecord;
};

describe('mode normalization helpers', () => {
  it('normalizes frontend aliases to assistant modes', () => {
    expect(normalizeModeFromFrontend('assist')).toBe('COPILOTO');
    expect(normalizeModeFromFrontend('auto')).toBe('IA_AUTO');
    expect(normalizeModeFromFrontend('manual')).toBe('HUMANO');
  });

  it('accepts backend casing-insensitive aliases', () => {
    expect(normalizeModeFromFrontend('CoPilOtO')).toBe('COPILOTO');
    expect(normalizeModeFromFrontend('ia_auto')).toBe('IA_AUTO');
    expect(normalizeModeFromFrontend('HUMANO')).toBe('HUMANO');
  });

  it('returns null for unsupported values', () => {
    expect(normalizeModeFromFrontend('unknown-mode')).toBeNull();
  });

  it('maps assistant mode to frontend value', () => {
    expect(modeToFrontend('COPILOTO')).toBe('assist');
    expect(modeToFrontend('IA_AUTO')).toBe('auto');
    expect(modeToFrontend('HUMANO')).toBe('manual');
    expect(modeToFrontend(DEFAULT_MODE)).toBe('assist');
  });
});

describe('defaultSuggestionSchema', () => {
  it('describes the structured AI suggestion contract', () => {
    expect(defaultSuggestionSchema).toMatchObject({
      type: 'object',
      required: ['next_step', 'tips', 'objections', 'confidence'],
      properties: expect.objectContaining({
        next_step: { type: 'string' },
        tips: expect.any(Object),
        objections: expect.any(Object),
        confidence: { type: 'number' },
      }),
    });
  });
});

describe('buildConfigUpsertPayload', () => {
  it('prefers overrides but falls back to existing values', () => {
    const existing = buildExistingConfig();

    const payload = buildConfigUpsertPayload('tenant-123', 'queue-99', existing, {
      model: 'gpt-4o-mini',
      streamingEnabled: true,
      defaultMode: 'IA_AUTO',
    });

    expect(payload).toMatchObject({
      tenantId: 'tenant-123',
      queueId: 'queue-99',
      scopeKey: 'queue-99',
      model: 'gpt-4o-mini',
      streamingEnabled: true,
      vectorStoreIds: ['vs_existing'],
      defaultMode: 'IA_AUTO',
      systemPromptReply: 'Seja cordial.',
      systemPromptSuggest: 'Envie sugestões resumidas.',
    });
  });

  it('fills defaults when config record is absent', () => {
    const payload = buildConfigUpsertPayload('tenant-999', null, null, {});

    expect(payload).toMatchObject({
      tenantId: 'tenant-999',
      queueId: null,
      scopeKey: '__global__',
      model: envAiConfig.defaultModel,
      structuredOutputSchema: null,
      tools: null,
      vectorStoreIds: [],
      defaultMode: DEFAULT_MODE,
    });
  });
});
