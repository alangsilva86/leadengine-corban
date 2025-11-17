import { Router, type Request, type Response } from 'express';
import { body, query } from 'express-validator';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  getAiConfig,
  upsertAiConfig,
  type UpsertAiConfigInput,
  recordAiSuggestion,
  upsertAiMemory,
  type AiAssistantMode,
  recordAiRun,
} from '@ticketz/storage';
import type { Prisma } from '@prisma/client';
import { suggestWithAi, AiServiceError } from '../services/ai/openai-client';
import { RESPONSES_API_URL, aiConfig as envAiConfig, isAiEnabled } from '../config/ai';
import { logger } from '../config/logger';
import { getRegisteredTools, executeTool } from '../services/ai/tool-registry';
import { ReplyStreamer } from './reply-streamer';
import { ensureTenantId, readQueueParam } from './ai/utils';

const router: Router = Router();

const defaultSuggestionSchema: Prisma.JsonValue = {
  type: 'object',
  additionalProperties: false,
  required: ['next_step', 'tips', 'objections', 'confidence'],
  properties: {
    next_step: { type: 'string' },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'message'],
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
    objections: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label', 'reply'],
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          reply: { type: 'string' },
        },
      },
    },
    confidence: { type: 'number' },
  },
};

const DEFAULT_MODE: AiAssistantMode = 'COPILOTO';

// Mapeamento de modos do frontend para o backend
const normalizeModeFromFrontend = (mode: string): AiAssistantMode | null => {
  const normalized = mode.trim().toLowerCase();
  
  // Aceitar valores do frontend
  if (normalized === 'assist') return 'COPILOTO';
  if (normalized === 'auto' || normalized === 'autonomous') return 'IA_AUTO';
  if (normalized === 'manual') return 'HUMANO';
  
  // Aceitar valores do backend (case-insensitive)
  if (normalized === 'copiloto') return 'COPILOTO';
  if (normalized === 'ia_auto') return 'IA_AUTO';
  if (normalized === 'humano') return 'HUMANO';
  
  return null;
};

// Converter modo do backend para formato do frontend
const modeToFrontend = (mode: AiAssistantMode): string => {
  if (mode === 'COPILOTO') return 'assist';
  if (mode === 'IA_AUTO') return 'auto';
  if (mode === 'HUMANO') return 'manual';
  return 'assist'; // fallback
};

type AiConfigRecord = Awaited<ReturnType<typeof getAiConfig>>;

const buildConfigUpsertPayload = (
  tenantId: string,
  queueId: string | null,
  existing: AiConfigRecord,
  overrides: Partial<UpsertAiConfigInput> = {}
): UpsertAiConfigInput => {
  const temperature = overrides.temperature ?? existing?.temperature;
  const maxOutputTokens = overrides.maxOutputTokens ?? existing?.maxOutputTokens ?? null;
  const systemPromptReply = overrides.systemPromptReply ?? existing?.systemPromptReply ?? null;
  const systemPromptSuggest = overrides.systemPromptSuggest ?? existing?.systemPromptSuggest ?? null;
  const structuredOutputSchema =
    overrides.structuredOutputSchema ?? existing?.structuredOutputSchema ?? null;
  const tools = overrides.tools ?? existing?.tools ?? null;
  const vectorStoreEnabled = overrides.vectorStoreEnabled ?? existing?.vectorStoreEnabled;
  const vectorStoreIds = overrides.vectorStoreIds ?? existing?.vectorStoreIds;
  const streamingEnabled = overrides.streamingEnabled ?? existing?.streamingEnabled;
  const defaultMode = overrides.defaultMode ?? existing?.defaultMode ?? DEFAULT_MODE;
  const confidenceThreshold =
    overrides.confidenceThreshold ?? existing?.confidenceThreshold;
  const fallbackPolicy = overrides.fallbackPolicy ?? existing?.fallbackPolicy;

  const payload: UpsertAiConfigInput = {
    tenantId,
    queueId,
    scopeKey: queueId ?? '__global__',
    model: overrides.model ?? existing?.model ?? envAiConfig.defaultModel,
    maxOutputTokens,
    systemPromptReply,
    systemPromptSuggest,
    structuredOutputSchema,
    tools,
    defaultMode,
  };

  if (temperature !== undefined) {
    payload.temperature = temperature;
  }
  if (vectorStoreEnabled !== undefined) {
    payload.vectorStoreEnabled = vectorStoreEnabled;
  }
  payload.vectorStoreIds = vectorStoreIds ?? [];
  if (streamingEnabled !== undefined) {
    payload.streamingEnabled = streamingEnabled;
  }
  if (confidenceThreshold !== undefined) {
    payload.confidenceThreshold = confidenceThreshold;
  }
  if (fallbackPolicy !== undefined) {
    payload.fallbackPolicy = fallbackPolicy ?? null;
  }

  return payload;
};

const modeValidators = [
  body('mode')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Modo é obrigatório')
    .custom((value) => {
      const normalized = normalizeModeFromFrontend(value);
      if (!normalized) {
        throw new Error('Modo inválido: use assist/auto/manual ou IA_AUTO/COPILOTO/HUMANO.');
      }
      return true;
    }),
  body('queueId').optional({ nullable: true }).isString().trim(),
];

router.get(
  '/mode',
  requireTenant,
  query('queueId').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const queueId = readQueueParam(req);
    const config = await getAiConfig(tenantId, queueId);

    const backendMode = config?.defaultMode ?? DEFAULT_MODE;
    res.json({
      success: true,
      data: {
        mode: modeToFrontend(backendMode),
        aiEnabled: isAiEnabled,
      },
    });
  })
);

router.post(
  '/mode',
  requireTenant,
  modeValidators,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const queueId = readQueueParam(req);
    const rawMode = req.body.mode as string;
    const mode = normalizeModeFromFrontend(rawMode) ?? DEFAULT_MODE;

    const existing = await getAiConfig(tenantId, queueId);
    const configData = buildConfigUpsertPayload(tenantId, queueId, existing, { defaultMode: mode });
    const config = await upsertAiConfig(configData);

    logger.info('crm.ai.mode.updated', {
      tenantId,
      queueId,
      mode,
    });

    const backendMode = config.defaultMode ?? DEFAULT_MODE;
    res.json({
      success: true,
      data: {
        mode: modeToFrontend(backendMode),
      },
    });
  })
);

router.get(
  '/config',
  requireTenant,
  query('queueId').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const queueId = readQueueParam(req);

    const existing = await getAiConfig(tenantId, queueId);

    if (!existing) {
      return res.json({
        success: true,
        data: {
          tenantId,
          queueId,
          model: envAiConfig.defaultModel,
          temperature: 0.3,
          maxOutputTokens: null,
          systemPromptReply: null,
          systemPromptSuggest: null,
          structuredOutputSchema: defaultSuggestionSchema,
          tools: [],
          vectorStoreEnabled: false,
          vectorStoreIds: [],
          streamingEnabled: true,
          defaultMode: DEFAULT_MODE,
          confidenceThreshold: 0,
          fallbackPolicy: null,
          aiEnabled: isAiEnabled,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        ...existing,
        defaultMode: existing.defaultMode ?? DEFAULT_MODE,
        aiEnabled: isAiEnabled,
      },
    });
  })
);

const configValidators = [
  body('model').isString().trim().notEmpty(),
  body('temperature').optional().isFloat({ min: 0, max: 2 }).toFloat(),
  body('maxOutputTokens').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  body('systemPromptReply').optional({ nullable: true }).isString(),
  body('systemPromptSuggest').optional({ nullable: true }).isString(),
  body('structuredOutputSchema').optional({ nullable: true }).custom((value) => {
    if (value === null || typeof value === 'object') {
      return true;
    }
    throw new Error('structuredOutputSchema must be an object');
  }),
  body('tools').optional({ nullable: true }).isArray(),
  body('vectorStoreEnabled').optional().isBoolean().toBoolean(),
  body('vectorStoreIds').optional().isArray(),
  body('streamingEnabled').optional().isBoolean().toBoolean(),
  body('defaultMode')
    .optional({ nullable: true })
    .isIn(['IA_AUTO', 'COPILOTO', 'HUMANO'])
    .bail(),
  body('confidenceThreshold').optional({ nullable: true }).isFloat({ min: 0, max: 1 }).toFloat(),
  body('fallbackPolicy').optional({ nullable: true }).isString(),
  body('queueId').optional({ nullable: true }).isString().trim(),
];

router.put(
  '/config',
  requireTenant,
  configValidators,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const queueId = readQueueParam(req);
    const payload = req.body as UpsertAiConfigInput;
    const existing = await getAiConfig(tenantId, queueId);

    const overrideConfig: Partial<UpsertAiConfigInput> = {
      model: payload.model,
      maxOutputTokens: payload.maxOutputTokens ?? null,
      systemPromptReply: payload.systemPromptReply ?? null,
      systemPromptSuggest: payload.systemPromptSuggest ?? null,
      structuredOutputSchema: payload.structuredOutputSchema ?? null,
      tools: payload.tools ?? null,
      vectorStoreEnabled: payload.vectorStoreEnabled ?? false,
      vectorStoreIds: payload.vectorStoreIds ?? [],
      streamingEnabled: payload.streamingEnabled ?? true,
      defaultMode: payload.defaultMode ?? existing?.defaultMode ?? DEFAULT_MODE,
      confidenceThreshold: payload.confidenceThreshold ?? null,
      fallbackPolicy: payload.fallbackPolicy ?? null,
    };

    if (payload.temperature !== undefined) {
      overrideConfig.temperature = payload.temperature;
    }

    const configData = buildConfigUpsertPayload(tenantId, queueId, existing, overrideConfig);

    const config = await upsertAiConfig(configData);

    return res.json({
      success: true,
      data: {
        ...config,
        defaultMode: config.defaultMode ?? DEFAULT_MODE,
        aiEnabled: isAiEnabled,
      },
    });
  })
);

const replyValidators = [
  body('conversationId').isString().notEmpty(),
  body('messages')
    .isArray({ min: 1 })
    .withMessage('messages deve ser um array com pelo menos uma mensagem.'),
  body('messages.*.role')
    .isIn(['user', 'assistant', 'system'])
    .withMessage('role deve ser user, assistant ou system.'),
  body('messages.*.content')
    .isString()
    .notEmpty()
    .withMessage('content deve ser texto não vazio.'),
  body('metadata').optional({ nullable: true }).isObject(),
  body('queueId').optional({ nullable: true }).isString(),
];

router.post(
  '/reply',
  requireTenant,
  replyValidators,
  validateRequest,
  (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const { conversationId, messages, metadata = {} } = req.body as {
      conversationId: string;
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      metadata?: Record<string, unknown>;
    };

    const queueId = readQueueParam(req);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    (res as any).flushHeaders?.();

    const sendEvent = (event: string, data: unknown) => {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      res.write(`event: ${event}\n`);
      res.write(`data: ${payload}\n\n`);
    };

    const abortController = new AbortController();
    const signal = abortController.signal;
    let aborted = false;

    const streamTimeoutId = setTimeout(() => {
      if (!abortController.signal.aborted) {
        abortController.abort();
      }
    }, envAiConfig.streamTimeoutMs);

    req.on('close', () => {
      if (!abortController.signal.aborted) {
        aborted = true;
        abortController.abort();
      }
    });

    const handleStreaming = async () => {
      const startedAt = Date.now();
      let config = await getAiConfig(tenantId, queueId);
      if (!config && queueId) {
        config = await getAiConfig(tenantId, null);
        if (config) {
          logger.debug('crm.ai.reply.config_fallback', {
            tenantId,
            queueId,
            fallback: 'global',
            configId: config.id,
          });
        }
      }

      if (!config) {
        config = await upsertAiConfig({
          tenantId,
          queueId,
          scopeKey: queueId ?? '__global__',
          model: envAiConfig.defaultModel,
          structuredOutputSchema: defaultSuggestionSchema,
        });
        logger.debug('crm.ai.reply.config_created', {
          tenantId,
          queueId,
          configId: config.id,
        });
      }

      const sanitizeMetadata = (raw?: Record<string, unknown> | null): Record<string, string> | undefined => {
        if (!raw || typeof raw !== 'object') return undefined;
        const entries = Object.entries(raw)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([key, value]) => [key, typeof value === 'string' ? value : String(value)]);
        return entries.length > 0 ? (Object.fromEntries(entries) as Record<string, string>) : undefined;
      };

      const normalizeContentType = (role: 'user' | 'assistant' | 'system'): 'input_text' | 'output_text' => {
        if (role === 'assistant') {
          return 'output_text';
        }
        return 'input_text';
      };

      const requestMessages = [
        ...(config.systemPromptReply
          ? [
              {
                role: 'system' as const,
                content: [{ type: 'input_text' as const, text: config.systemPromptReply }],
              },
            ]
          : []),
        ...messages.map((message) => ({
          role: message.role,
          content: [{ type: normalizeContentType(message.role), text: message.content }],
        })),
      ];

      const registeredTools = getRegisteredTools();
      const registryPayloads = registeredTools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.schema,
        },
      }));

      const configTools =
        Array.isArray(config.tools) && config.tools.length > 0
          ? (config.tools as Array<Record<string, unknown>>)
          : [];

      const uniqueToolNames = new Set<string>();
      const mergedTools: Array<Record<string, unknown>> = [];

      for (const tool of [...configTools, ...registryPayloads]) {
        const toolName =
          typeof tool === 'object' && tool !== null
            ? (tool as any)?.function?.name ?? (tool as any)?.name
            : null;
        if (toolName && uniqueToolNames.has(toolName)) {
          continue;
        }
        if (toolName) {
          uniqueToolNames.add(toolName);
        }
        mergedTools.push(tool);
      }

      const requestBody: Record<string, unknown> = {
        model: config.model ?? envAiConfig.defaultModel,
        input: requestMessages,
        temperature: config.temperature ?? undefined,
        max_output_tokens: config.maxOutputTokens ?? undefined,
        response_format: { type: 'text' },
        metadata: {
          tenantId,
          conversationId,
          ...(sanitizeMetadata(metadata) ?? {}),
        },
        tools: mergedTools.length > 0 ? mergedTools : undefined,
      };

      logger.debug('🎛️ AI STREAM :: requisição pronta para a OpenAI', {
        tenantId,
        conversationId,
        model: requestBody.model,
        stream: true,
        metadataPreview: requestBody.metadata,
        toolCount: mergedTools.length,
      });

      requestBody.stream = true;
      requestBody.stream_options = { include_usage: true };

      if (!isAiEnabled) {
        const fallbackChunks = [
          'Ainda estou configurando a IA neste workspace, ',
          'mas já anotei a solicitação.',
          ' Um atendente humano assume a conversa em instantes.',
        ];
        let combined = '';
        for (const chunk of fallbackChunks) {
          combined += chunk;
          sendEvent('delta', { delta: chunk });
        }
        sendEvent('done', {
          message: combined,
          model: 'stub',
          usage: null,
          toolCalls: [],
          status: 'stubbed',
        });
        await recordAiRun({
          tenantId,
          conversationId,
          configId: config.id,
          runType: 'reply',
          requestPayload: { stub: true } as Prisma.JsonValue,
          responsePayload: { message: combined } as Prisma.JsonValue,
          latencyMs: Date.now() - startedAt,
          status: 'stubbed',
        });
        res.end();
        return;
      }

      const response = await fetch(RESPONSES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${envAiConfig.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok || !response.body) {
        const payload = await response.text().catch(() => null);
        throw new Error(
          `OpenAI streaming falhou (${response.status} ${response.statusText})${
            payload ? ` :: ${payload}` : ''
          }`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const streamer = new ReplyStreamer({
        tenantId,
        conversationId,
        configId: config.id,
        model: requestBody.model as string,
        requestPayload: requestBody,
        sendEvent,
        executeTool,
        recordAiRun,
        responsesApiUrl: RESPONSES_API_URL,
        apiKey: envAiConfig.apiKey ?? null,
        signal,
        logger,
        toolTimeoutMs: envAiConfig.toolTimeoutMs,
        toolMaxRetries: envAiConfig.toolMaxRetries,
        toolMaxConcurrency: envAiConfig.toolMaxConcurrency,
        toolRetryDelayMs: envAiConfig.toolRetryDelayMs,
      });

      const processEvent = (payload: any) => {
        streamer.handleEvent(payload);
      };

      let streamClosed = false;
      while (!streamClosed) {
        const { value, done } = await reader.read();
        if (done) {
          streamClosed = true;
        } else {
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const raw = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const dataLines = raw
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean);
            for (const line of dataLines) {
              if (!line.startsWith('data:')) {
                continue;
              }
              const dataPayload = line.slice(5).trim();
              if (!dataPayload) {
                continue;
              }
              if (dataPayload === '[DONE]') {
                streamClosed = true;
                break;
              }
              try {
                const parsed = JSON.parse(dataPayload);
                processEvent(parsed);
              } catch (error) {
                logger.warn('crm.ai.reply.stream.parse_error', {
                  dataPayload,
                  error,
                });
              }
            }
            boundary = buffer.indexOf('\n\n');
          }
        }
      }

      const summary = await streamer.finalize();

      if (aborted) {
        await recordAiRun({
          tenantId,
          conversationId,
          configId: config.id,
          runType: 'reply',
          requestPayload: requestBody as Prisma.JsonValue,
          responsePayload: {
            message: summary.message,
            toolCalls: summary.toolCalls,
          } as Prisma.JsonValue,
          latencyMs: Date.now() - startedAt,
          status: 'aborted',
        });
        return;
      }

      sendEvent('done', {
        message: summary.message,
        model: summary.model,
        usage: summary.usage,
        toolCalls: summary.toolCalls,
        status: summary.completed ? 'success' : 'partial',
      });

      const usagePayload = summary.usage ?? undefined;
      const promptTokens =
        usagePayload && typeof usagePayload === 'object'
          ? (usagePayload as { prompt_tokens?: number }).prompt_tokens ?? null
          : null;
      const completionTokens =
        usagePayload && typeof usagePayload === 'object'
          ? (usagePayload as { completion_tokens?: number }).completion_tokens ?? null
          : null;
      const totalTokens =
        usagePayload && typeof usagePayload === 'object'
          ? (usagePayload as { total_tokens?: number }).total_tokens ?? null
          : null;

      const runResponsePayload = {
        message: summary.message,
        toolCalls: summary.toolCalls,
        usage: usagePayload ?? null,
      };

      await recordAiRun({
        tenantId,
        conversationId,
        configId: config.id,
        runType: 'reply',
        requestPayload: requestBody as Prisma.JsonValue,
        responsePayload: runResponsePayload as unknown as Prisma.JsonValue,
        latencyMs: Date.now() - startedAt,
        promptTokens,
        completionTokens,
        totalTokens,
        status: summary.completed ? 'success' : 'partial',
      });

      res.end();
    };

    handleStreaming().catch((error) => {
      logger.error('crm.ai.reply.failed', {
        tenantId,
        conversationId,
        error,
      });
      if (!res.headersSent || !res.writableEnded) {
        sendEvent('error', {
          message: (error as Error).message,
        });
        res.end();
      }
    }).finally(() => {
      clearTimeout(streamTimeoutId);
    });
  }
);

const memoryUpsertValidators = [
  body('contactId').isString().notEmpty(),
  body('topic').isString().notEmpty(),
  body('content').isString().notEmpty(),
  body('metadata').optional({ nullable: true }).isObject(),
  body('expiresAt').optional({ nullable: true }).isISO8601(),
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

// Keep in sync with MAX_AI_TIMELINE_ITEMS in
// apps/web/src/features/chat/utils/aiTimeline.js so backend truncation matches
// the frontend behaviour when preparing AI context.
const MAX_AI_TIMELINE_ITEMS = 50;

const parseMessageRole = (value: unknown): 'user' | 'assistant' | 'system' => {
  if (!value) {
    return 'user';
  }

  const normalized = String(value).trim().toLowerCase();

  if (['assistant', 'agent', 'outbound', 'auto'].includes(normalized)) {
    return 'assistant';
  }

  if (normalized === 'system') {
    return 'system';
  }

  return 'user';
};

const getEntryPayload = (entry: unknown): Record<string, unknown> | null => {
  if (!isRecord(entry)) {
    return null;
  }

  if (isRecord(entry.payload)) {
    return entry.payload;
  }

  return entry;
};

const getEntryContent = (payload: Record<string, unknown>): string | null => {
  const candidates = [
    payload.content,
    payload.text,
    payload.body,
    payload.message,
    payload.messageText,
  ];

  for (const candidate of candidates) {
    if (isNonEmptyString(candidate)) {
      return candidate;
    }
  }

  return null;
};

const buildMessagesFromTimeline = (
  timeline: unknown
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> => {
  if (!Array.isArray(timeline)) {
    return [];
  }

  const truncatedTimeline = timeline.slice(-MAX_AI_TIMELINE_ITEMS);

  return truncatedTimeline
    .map((entry) => {
      const payload = getEntryPayload(entry);
      if (!payload) {
        return null;
      }

      const content = getEntryContent(payload);
      if (!content) {
        return null;
      }

      const roleSource =
        (payload.role as string | undefined) ??
        (payload.direction as string | undefined) ??
        (payload.authorRole as string | undefined);

      return {
        role: parseMessageRole(roleSource),
        content,
      };
    })
    .filter(
      (message): message is { role: 'user' | 'assistant' | 'system'; content: string } =>
        Boolean(message)
    );
};

const sanitizeLastMessages = (
  messages: unknown
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => {
      if (!isRecord(message)) {
        return null;
      }

      const content = isNonEmptyString(message.content)
        ? message.content
        : null;
      if (!content) {
        return null;
      }

      return {
        role: parseMessageRole(message.role),
        content,
      };
    })
    .filter(
      (message): message is { role: 'user' | 'assistant' | 'system'; content: string } =>
        Boolean(message)
    );
};

const buildLeadProfileFromTicket = (ticket: unknown): Record<string, unknown> | null => {
  if (!isRecord(ticket)) {
    return null;
  }

  const profile: Record<string, unknown> = {};

  if (isNonEmptyString(ticket.id)) {
    profile.ticketId = ticket.id.trim();
  }
  if (isNonEmptyString(ticket.status)) {
    profile.status = ticket.status;
  }
  if (isNonEmptyString(ticket.stage)) {
    profile.stage = ticket.stage;
  }
  if (ticket.value !== undefined && ticket.value !== null) {
    profile.value = ticket.value;
  }

  const contact = ticket.contact;
  if (isRecord(contact)) {
    const contactProfile: Record<string, unknown> = {};

    if (isNonEmptyString(contact.id)) {
      contactProfile.id = contact.id.trim();
    }
    if (isNonEmptyString(contact.name)) {
      contactProfile.name = contact.name;
    }
    if (isNonEmptyString(contact.phone)) {
      contactProfile.phone = contact.phone;
    }

    if (Object.keys(contactProfile).length > 0) {
      profile.contact = contactProfile;
    }
  }

  if (isRecord(ticket.metadata) && Object.keys(ticket.metadata).length > 0) {
    profile.metadata = ticket.metadata;
  }

  return Object.keys(profile).length > 0 ? profile : null;
};

const suggestValidators = [
  body('conversationId').optional({ checkFalsy: true }).isString().trim(),
  body('goal').optional({ nullable: true }).isString(),
  body('lastMessages').optional().isArray(),
  body('leadProfile').optional({ nullable: true }).isObject(),
  body('queueId').optional({ nullable: true }).isString(),
  body('ticket').optional({ nullable: true }).isObject(),
  body('timeline').optional({ nullable: true }).isArray(),
  body()
    .custom((value) => {
      const conversationId = value?.conversationId;
      const ticketId = value?.ticket?.id;

      if (!isNonEmptyString(conversationId) && !isNonEmptyString(ticketId)) {
        throw new Error('Informe conversationId ou ticket.id para solicitar sugestão.');
      }

      return true;
    })
    .withMessage('Informe conversationId ou ticket.id para solicitar sugestão.'),
];

router.post(
  '/suggest',
  requireTenant,
  suggestValidators,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const { conversationId: bodyConversationId, goal: rawGoal } = req.body as {
      conversationId?: unknown;
      goal?: unknown;
    };

    const requestBody = req.body as {
      lastMessages?: unknown;
      leadProfile?: unknown;
      ticket?: unknown;
      timeline?: unknown;
    };

    const ticketProfile = buildLeadProfileFromTicket(requestBody.ticket);

    const goal = isNonEmptyString(rawGoal) ? rawGoal : undefined;

    const lastMessages = sanitizeLastMessages(requestBody.lastMessages);
    const timelineMessages = buildMessagesFromTimeline(requestBody.timeline);
    const messagesForPrompt = lastMessages.length > 0 ? lastMessages : timelineMessages;

    const leadProfile = isRecord(requestBody.leadProfile)
      ? requestBody.leadProfile
      : ticketProfile ?? undefined;

    const ticketIdFromProfile =
      ticketProfile && isNonEmptyString(ticketProfile.ticketId)
        ? ticketProfile.ticketId
        : undefined;
    const ticketIdFromRequest =
      isRecord(requestBody.ticket) && isNonEmptyString(requestBody.ticket.id)
        ? requestBody.ticket.id.trim()
        : undefined;

    const resolvedTicketId = ticketIdFromProfile ?? ticketIdFromRequest;

    const conversationId = isNonEmptyString(bodyConversationId)
      ? bodyConversationId.trim()
      : resolvedTicketId ?? null;

    if (!conversationId) {
      throw new Error('conversationId não pôde ser determinado.');
    }

    const queueId = readQueueParam(req);
    let config = await getAiConfig(tenantId, queueId);
    if (!config && queueId) {
      config = await getAiConfig(tenantId, null);
      if (config) {
        logger.debug('crm.ai.suggest.config_fallback', {
          tenantId,
          queueId,
          fallback: 'global',
          configId: config.id,
        });
      }
    }

    if (!config) {
      config = await upsertAiConfig({
        tenantId,
        queueId,
        scopeKey: queueId ?? '__global__',
        model: envAiConfig.defaultModel,
        structuredOutputSchema: defaultSuggestionSchema,
      });
      logger.debug('crm.ai.suggest.config_created', {
        tenantId,
        queueId,
        configId: config.id,
      });
    }

    const contextPieces: string[] = [];
    if (leadProfile) {
      contextPieces.push(`Perfil do lead: ${JSON.stringify(leadProfile)}`);
    }

    const historyText = messagesForPrompt
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n');

    const promptParts = [
      goal ?? 'Gerar nota interna com próximos passos e recomendações.',
      historyText,
      contextPieces.join('\n'),
    ].filter(Boolean);

    const prompt = promptParts.join('\n\n');
    const textFormatInput = isRecord((req.body as Record<string, unknown>).text)
      ? ((req.body as Record<string, unknown>).text as Record<string, unknown>)
      : null;
    const rawFormatDetails = textFormatInput && isRecord(textFormatInput.format)
      ? (textFormatInput.format as Record<string, unknown>)
      : null;
    const formatNameCandidate = rawFormatDetails && isNonEmptyString(rawFormatDetails.name)
      ? (rawFormatDetails.name as string).trim()
      : null;
    const normalizedFormatName = formatNameCandidate ? formatNameCandidate.toLowerCase() : null;

    const schemaCandidate =
      (rawFormatDetails && 'schema' in rawFormatDetails
        ? (rawFormatDetails.schema as Prisma.JsonValue)
        : null) ??
      (config.structuredOutputSchema ?? defaultSuggestionSchema);

    const strictFlag =
      rawFormatDetails && typeof rawFormatDetails.strict === 'boolean'
        ? Boolean(rawFormatDetails.strict)
        : true;

    const outputFormat = normalizedFormatName === 'plain' || rawFormatDetails?.type === 'text'
      ? ({ type: 'text', name: formatNameCandidate ?? 'plain' } as const)
      : ({
          type: 'json_schema',
          name: formatNameCandidate ?? 'AiSuggestion',
          schema: schemaCandidate,
          strict: strictFlag,
        } as const);

    try {
      const aiResult = await suggestWithAi({
        tenantId,
        conversationId,
        configId: config.id,
        config,
        queueId,
        prompt,
        contextMessages: messagesForPrompt,
        structuredSchema: config.structuredOutputSchema ?? defaultSuggestionSchema,
        outputFormat,
        metadata: {
          tenantId,
          conversationId,
          ...(queueId ? { queueId } : {}),
          ...(goal ? { goal } : {}),
          ...(leadProfile ? { leadProfile } : {}),
          ...(resolvedTicketId ? { ticketId: resolvedTicketId } : {}),
        },
      });

      await recordAiSuggestion({
        tenantId,
        conversationId,
        configId: config.id,
        payload: aiResult.payload,
        confidence: aiResult.confidence ?? null,
      });

      logger.info('crm.ai.suggest.completed', {
        tenantId,
        conversationId,
        model: aiResult.model,
        confidence: aiResult.confidence,
      });

      return res.json({
        success: true,
        data: {
          suggestion: aiResult.payload,
          confidence: aiResult.confidence ?? null,
          model: aiResult.model,
          usage: aiResult.usage,
          aiEnabled: isAiEnabled,
        },
      });
    } catch (error) {
      const statusFromError =
        error instanceof AiServiceError && Number.isFinite(error.status) ? error.status : 502;
      const message =
        error instanceof Error
          ? error.message || 'Falha ao gerar sugestões da IA.'
          : 'Falha ao gerar sugestões da IA.';

      const sanitizeDetails = (value: unknown) => {
        if (!value) return undefined;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
          try {
            return JSON.parse(JSON.stringify(value));
          } catch {
            return undefined;
          }
        }
        return undefined;
      };

      const details =
        error instanceof AiServiceError ? sanitizeDetails(error.details) : undefined;

      logger.error('crm.ai.suggest.failed', {
        tenantId,
        conversationId,
        queueId,
        message,
        details,
        error,
      });

      return res.status(statusFromError).json({
        success: false,
        error: {
          message,
          ...(details !== undefined ? { details } : {}),
        },
      });
    }
  })
);

router.post(
  '/memory/upsert',
  requireTenant,
  memoryUpsertValidators,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const { contactId, topic, content, metadata = null, expiresAt } = req.body as {
      contactId: string;
      topic: string;
      content: string;
      metadata?: Record<string, unknown> | null;
      expiresAt?: string | null;
    };

    const record = await upsertAiMemory({
      tenantId,
      contactId,
      topic,
      content,
      metadata: (metadata ?? null) as Prisma.JsonValue | null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    logger.info('crm.ai.memory.upserted', {
      tenantId,
      contactId,
      topic,
    });

    return res.json({
      success: true,
      data: {
        id: record.id,
        contactId: record.contactId,
        topic: record.topic,
        content: record.content,
        metadata: record.metadata,
        expiresAt: record.expiresAt,
        updatedAt: record.updatedAt,
      },
    });
  })
);

export { router as aiRouter };
