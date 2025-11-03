import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../prisma-client';

const prisma = (): PrismaClient => getPrismaClient();

export type AiAssistantMode = 'IA_AUTO' | 'COPILOTO' | 'HUMANO';

export type UpsertAiConfigInput = {
  tenantId: string;
  queueId?: string | null;
  scopeKey?: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number | null;
  systemPromptReply?: string | null;
  systemPromptSuggest?: string | null;
  structuredOutputSchema?: Prisma.JsonValue | null;
  tools?: Prisma.JsonValue | null;
  vectorStoreEnabled?: boolean;
  vectorStoreIds?: string[];
  streamingEnabled?: boolean;
  defaultMode?: AiAssistantMode;
  confidenceThreshold?: number | null;
  fallbackPolicy?: string | null;
};

export const getAiConfig = async (tenantId: string, queueId?: string | null) => {
  const scopeKey = queueId ?? '__global__';
  console.log('🔍 getAiConfig CHAMADO:', { tenantId, queueId, scopeKey });
  const result = await prisma().aiConfig.findFirst({
    where: {
      tenantId,
      scopeKey,
    },
  });
  console.log('🔍 getAiConfig RESULTADO:', { 
    found: !!result, 
    defaultMode: result?.defaultMode,
    id: result?.id,
    scopeKey: result?.scopeKey 
  });
  return result;
};

export const upsertAiConfig = async (input: UpsertAiConfigInput) => {
  const {
    tenantId,
    queueId = null,
    scopeKey: providedScope,
    model,
    temperature,
    maxOutputTokens,
    systemPromptReply,
    systemPromptSuggest,
    structuredOutputSchema,
    tools,
    vectorStoreEnabled,
    vectorStoreIds,
    streamingEnabled,
    defaultMode,
    confidenceThreshold,
    fallbackPolicy,
  } = input;

  const scopeKey = providedScope ?? queueId ?? '__global__';

  const finalTemperature = temperature ?? undefined;
  const finalMaxOutputTokens = maxOutputTokens ?? null;
  const finalSystemPromptReply = systemPromptReply ?? null;
  const finalSystemPromptSuggest = systemPromptSuggest ?? null;
  const finalStructuredOutputSchema =
    structuredOutputSchema ?? null;
  const finalTools = tools ?? null;
  const finalVectorStoreEnabled = vectorStoreEnabled ?? false;
  const finalVectorStoreIds = vectorStoreIds ?? [];
  const finalStreamingEnabled = streamingEnabled ?? true;
  const finalDefaultMode = defaultMode ?? 'COPILOTO';
  const finalConfidenceThreshold = confidenceThreshold ?? null;
  const finalFallbackPolicy = fallbackPolicy ?? null;

  const updateData: Prisma.AiConfigUncheckedUpdateInput = {
    queueId,
    scopeKey,
    model,
    ...(finalTemperature !== undefined ? { temperature: finalTemperature } : {}),
    maxOutputTokens: finalMaxOutputTokens,
    systemPromptReply: finalSystemPromptReply,
    systemPromptSuggest: finalSystemPromptSuggest,
    structuredOutputSchema:
      finalStructuredOutputSchema === null ? Prisma.JsonNull : finalStructuredOutputSchema,
    tools: finalTools === null ? Prisma.JsonNull : finalTools,
    vectorStoreEnabled: finalVectorStoreEnabled,
    vectorStoreIds: finalVectorStoreIds,
    streamingEnabled: finalStreamingEnabled,
    defaultMode: finalDefaultMode,
    confidenceThreshold: finalConfidenceThreshold,
    fallbackPolicy: finalFallbackPolicy,
  };

  const createData: Prisma.AiConfigUncheckedCreateInput = {
    id: randomUUID(),
    tenantId,
    queueId,
    scopeKey,
    model,
    ...(finalTemperature !== undefined ? { temperature: finalTemperature } : {}),
    maxOutputTokens: finalMaxOutputTokens,
    systemPromptReply: finalSystemPromptReply,
    systemPromptSuggest: finalSystemPromptSuggest,
    structuredOutputSchema:
      finalStructuredOutputSchema === null ? Prisma.JsonNull : finalStructuredOutputSchema,
    tools: finalTools === null ? Prisma.JsonNull : finalTools,
    vectorStoreEnabled: finalVectorStoreEnabled,
    vectorStoreIds: finalVectorStoreIds,
    streamingEnabled: finalStreamingEnabled,
    defaultMode: finalDefaultMode,
    confidenceThreshold: finalConfidenceThreshold,
    fallbackPolicy: finalFallbackPolicy,
  };

  return prisma().aiConfig.upsert({
    where: {
      tenantId_scopeKey: {
        tenantId,
        scopeKey,
      },
    },
    update: updateData,
    create: createData,
  });
};

export const recordAiSuggestion = async (params: {
  tenantId: string;
  conversationId: string;
  configId?: string | null;
  payload: Prisma.JsonValue;
  confidence?: number | null;
}) => {
  const { tenantId, conversationId, configId, payload, confidence } = params;

  const data: Prisma.AiSuggestionUncheckedCreateInput = {
    id: randomUUID(),
    tenantId,
    conversationId,
    configId: configId ?? null,
    payload: payload === null ? Prisma.JsonNull : payload,
    confidence: confidence ?? null,
  };

  return prisma().aiSuggestion.create({
    data,
  });
};

export const upsertAiMemory = async (params: {
  tenantId: string;
  contactId: string;
  topic: string;
  content: string;
  metadata?: Prisma.JsonValue | null;
  expiresAt?: Date | null;
}) => {
  const { tenantId, contactId, topic, content, metadata, expiresAt } = params;

  const normalizedMetadata =
    metadata === undefined ? undefined : metadata === null ? Prisma.JsonNull : metadata;

  return prisma().aiMemory.upsert({
    where: {
      tenantId_contactId_topic: {
        tenantId,
        contactId,
        topic,
      },
    },
    update: {
      content,
      ...(normalizedMetadata !== undefined ? { metadata: normalizedMetadata } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    },
    create: {
      id: randomUUID(),
      tenantId,
      contactId,
      topic,
      content,
      ...(normalizedMetadata !== undefined ? { metadata: normalizedMetadata } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    },
  });
};

export const recordAiRun = async (params: {
  tenantId: string;
  conversationId: string;
  configId?: string | null;
  runType: string;
  adapter?: string | null;
  requestPayload: Prisma.JsonValue;
  responsePayload?: Prisma.JsonValue | null;
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  costUsd?: Prisma.Decimal | number | null;
  status?: string;
}) => {
  const {
    tenantId,
    conversationId,
    configId,
    runType,
    adapter,
    requestPayload,
    responsePayload,
    latencyMs,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
    status,
  } = params;

  const data: Prisma.AiRunUncheckedCreateInput = {
    id: randomUUID(),
    tenantId,
    conversationId,
    configId: configId ?? null,
    runType,
    adapter: adapter ?? null,
    requestPayload: requestPayload === null ? Prisma.JsonNull : requestPayload,
    ...(responsePayload !== undefined
      ? { responsePayload: responsePayload === null ? Prisma.JsonNull : responsePayload }
      : {}),
    latencyMs: latencyMs ?? null,
    promptTokens: promptTokens ?? null,
    completionTokens: completionTokens ?? null,
    totalTokens: totalTokens ?? null,
    costUsd: costUsd ?? null,
    status: status ?? 'success',
  };

  return prisma().aiRun.create({
    data,
  });
};
