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
import { suggestWithAi } from '../services/ai/openai-client';
import { aiConfig as envAiConfig, isAiEnabled } from '../config/ai';
import { logger } from '../config/logger';
import { getRegisteredTools, executeTool } from '../services/ai/tool-registry';
import { ReplyStreamer } from './reply-streamer';

const router: Router = Router();
const RESPONSES_API_URL = 'https://api.openai.com/v1/responses';

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

const readQueueParam = (req: Request): string | null => {
  const queueId = (req.query.queueId ?? req.body?.queueId) as string | undefined;
  return queueId?.trim() ? queueId.trim() : null;
};

const DEFAULT_MODE: AiAssistantMode = 'COPILOTO';

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
    .isIn(['IA_AUTO', 'COPILOTO', 'HUMANO'])
    .withMessage('Modo inválido: use IA_AUTO, COPILOTO ou HUMANO.'),
  body('queueId').optional({ nullable: true }).isString().trim(),
];

router.get(
  '/mode',
  requireTenant,
  query('queueId').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId!;
    const queueId = readQueueParam(req);
    const config = await getAiConfig(tenantId, queueId);

    res.json({
      success: true,
      data: {
        mode: config?.defaultMode ?? DEFAULT_MODE,
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
    const tenantId = req.user?.tenantId!;
    const queueId = readQueueParam(req);
    const { mode } = req.body as { mode: AiAssistantMode };

    const existing = await getAiConfig(tenantId, queueId);
    const configData = buildConfigUpsertPayload(tenantId, queueId, existing, { defaultMode: mode });
    const config = await upsertAiConfig(configData);

    logger.info('crm.ai.mode.updated', {
      tenantId,
      queueId,
      mode,
    });

    res.json({
      success: true,
      data: {
        mode: config.defaultMode ?? DEFAULT_MODE,
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
    const tenantId = req.user?.tenantId!;
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
    const tenantId = req.user?.tenantId!;
    const queueId = readQueueParam(req);
    const payload = req.body as UpsertAiConfigInput;
    const existing = await getAiConfig(tenantId, queueId);

    const configData = buildConfigUpsertPayload(tenantId, queueId, existing, {
      model: payload.model,
      temperature: payload.temperature,
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
    });

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
    const tenantId = req.user?.tenantId!;
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
      const config =
        (await getAiConfig(tenantId, queueId)) ??
        (await upsertAiConfig({
          tenantId,
          queueId,
          scopeKey: queueId ?? '__global__',
          model: envAiConfig.defaultModel,
          structuredOutputSchema: defaultSuggestionSchema,
        }));

      const requestMessages = [
        ...(config.systemPromptReply
          ? [
              {
                role: 'system' as const,
                content: [{ type: 'text' as const, text: config.systemPromptReply }],
              },
            ]
          : []),
        ...messages.map((message) => ({
          role: message.role,
          content: [{ type: 'text' as const, text: message.content }],
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
          ...metadata,
        },
        tools: mergedTools.length > 0 ? mergedTools : undefined,
      };

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
        apiKey: envAiConfig.apiKey,
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

const suggestValidators = [
  body('conversationId').isString().notEmpty(),
  body('goal').optional({ nullable: true }).isString(),
  body('lastMessages').optional().isArray(),
  body('leadProfile').optional({ nullable: true }).isObject(),
  body('queueId').optional({ nullable: true }).isString(),
];

router.post(
  '/suggest',
  requireTenant,
  suggestValidators,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId!;
    const { conversationId, goal, lastMessages = [], leadProfile } = req.body as {
      conversationId: string;
      goal?: string;
      lastMessages?: Array<{ role?: string; content?: string }>;
      leadProfile?: Record<string, unknown>;
    };

    const queueId = readQueueParam(req);
    const config =
      (await getAiConfig(tenantId, queueId)) ??
      (await upsertAiConfig({
        tenantId,
        queueId,
        scopeKey: queueId ?? '__global__',
        model: envAiConfig.defaultModel,
        structuredOutputSchema: defaultSuggestionSchema,
      }));

    const contextPieces: string[] = [];
    if (leadProfile) {
      contextPieces.push(`Perfil do lead: ${JSON.stringify(leadProfile)}`);
    }

    const historyText = lastMessages
      .map((message) => `${message.role ?? 'user'}: ${message.content ?? ''}`)
      .join('\n');

    const promptParts = [
      goal ?? 'Gerar nota interna com próximos passos e recomendações.',
      historyText,
      contextPieces.join('\n'),
    ].filter(Boolean);

    const prompt = promptParts.join('\n\n');

    const aiResult = await suggestWithAi({
      tenantId,
      conversationId,
      configId: config.id,
      prompt,
      contextMessages: lastMessages
        .filter((message): message is { role: 'user' | 'assistant' | 'system'; content: string } =>
          Boolean(message.content)
        )
        .map((message) => ({
          role: (message.role as 'user' | 'assistant' | 'system') ?? 'user',
          content: message.content ?? '',
        })),
      structuredSchema: config.structuredOutputSchema ?? defaultSuggestionSchema,
      metadata: {
        tenantId,
        conversationId,
        goal,
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
  })
);

router.post(
  '/memory/upsert',
  requireTenant,
  memoryUpsertValidators,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId!;
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
import { Router } from 'express';

import { configRouter } from './ai/config-router';
import { replyRouter } from './ai/reply-router';
import { suggestRouter } from './ai/suggest-router';
import { memoryRouter } from './ai/memory-router';

const router: Router = Router();

router.use('/', configRouter);
router.use('/', replyRouter);
router.use('/', suggestRouter);
router.use('/memory', memoryRouter);

export { router as aiRouter };
