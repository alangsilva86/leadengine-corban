import type { Prisma } from '@prisma/client';
import { recordAiRun } from '@ticketz/storage';

import { aiConfig as envAiConfig, isAiEnabled } from '../../config/ai';
import { logger } from '../../config/logger';
import { getRegisteredTools, executeTool } from '../../services/ai/tool-registry';
import { ensureAiConfig } from './config-controller';

const RESPONSES_API_URL = 'https://api.openai.com/v1/responses';

export type ReplyMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type ReplyStreamOptions = {
  tenantId: string;
  queueId: string | null;
  conversationId: string;
  messages: ReplyMessage[];
  metadata: Record<string, unknown>;
  signal: AbortSignal;
  sendEvent: (event: string, data: unknown) => void;
  onComplete?: () => void;
  isAborted?: () => boolean;
};

export const streamReply = async ({
  tenantId,
  queueId,
  conversationId,
  messages,
  metadata,
  signal,
  sendEvent,
  onComplete,
  isAborted,
}: ReplyStreamOptions) => {
  const startedAt = Date.now();
  const config = await ensureAiConfig(tenantId, queueId);

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
    onComplete?.();
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
  let completed = false;
  let aggregatedText = '';
  let modelUsed = requestBody.model as string;
  let usage: Record<string, unknown> | null = null;

  type ToolAccumulator = {
    id: string;
    name: string | null;
    argsChunks: string[];
  };

  const toolBuilders = new Map<string, ToolAccumulator>();
  const toolResults: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    status: 'success' | 'error';
    result?: unknown;
    error?: string;
  }> = [];

  const handleToolDelta = (payload: any) => {
    const callId = payload?.id ?? payload?.tool_call_id ?? payload?.call_id;
    if (!callId) {
      return;
    }
    const builder =
      toolBuilders.get(callId) ??
      ({
        id: callId,
        name: payload?.name ?? null,
        argsChunks: [],
      } as ToolAccumulator);
    if (payload?.name) {
      builder.name = payload.name;
    }
    if (payload?.arguments) {
      builder.argsChunks.push(payload.arguments as string);
    }
    toolBuilders.set(callId, builder);
  };

  const maybeExecuteTool = async (payload: any) => {
    const callId = payload?.id ?? payload?.tool_call_id ?? payload?.call_id;
    if (!callId) {
      return;
    }
    const builder = toolBuilders.get(callId);
    if (!builder || !builder.name) {
      return;
    }
    const argsText = builder.argsChunks.join('');
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = argsText ? JSON.parse(argsText) : {};
    } catch (error) {
      logger.warn('crm.ai.reply.tool.arguments_parse_failed', {
        callId,
        name: builder.name,
        error,
      });
    }

    sendEvent('tool_call', {
      id: callId,
      name: builder.name,
      status: 'executing',
      arguments: parsedArgs,
    });

    const execution = await executeTool(builder.name, parsedArgs, {
      tenantId,
      conversationId,
    });

    const toolRecord: {
      id: string;
      name: string;
      arguments: Record<string, unknown>;
      status: 'success' | 'error';
      result?: unknown;
      error?: string;
    } = {
      id: callId,
      name: builder.name,
      arguments: parsedArgs,
      status: execution.ok ? 'success' : 'error',
      result: execution.result,
    };
    if (!execution.ok) {
      toolRecord.error = execution.error ?? 'unknown_error';
    }
    toolResults.push(toolRecord);
    await recordAiRun({
      tenantId,
      conversationId,
      configId: config.id,
      runType: 'tool_call',
      requestPayload: {
        name: builder.name,
        arguments: parsedArgs as Prisma.JsonValue,
      } as Prisma.JsonValue,
      responsePayload: execution.ok
        ? ((execution.result ?? null) as Prisma.JsonValue)
        : ({ error: execution.error ?? 'unknown_error' } as Prisma.JsonValue),
      status: execution.ok ? 'success' : 'error',
    });

    sendEvent('tool_call', {
      ...toolRecord,
    });
  };

  const processEvent = async (payload: any) => {
    const type = payload?.type;
    switch (type) {
      case 'response.error':
        throw new Error(payload?.error?.message ?? 'Erro na resposta da IA');
      case 'response.output_text.delta': {
        const delta = payload?.delta ?? '';
        if (typeof delta === 'string' && delta.length > 0) {
          aggregatedText += delta;
          sendEvent('delta', { delta });
        }
        break;
      }
      case 'response.output_text.done': {
        const text = payload?.text;
        if (typeof text === 'string' && text.length > aggregatedText.length) {
          aggregatedText = text;
        }
        break;
      }
      case 'response.tool_call.delta':
        handleToolDelta(payload?.delta ?? payload);
        break;
      case 'response.tool_call.completed':
      case 'response.tool_call.done':
        await maybeExecuteTool(payload);
        break;
      case 'response.completed':
        completed = true;
        modelUsed = payload?.response?.model ?? modelUsed;
        usage = (payload?.response?.usage as Record<string, unknown>) ?? usage;
        break;
      default:
        break;
    }
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
            await processEvent(parsed);
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

  if (isAborted?.()) {
    await recordAiRun({
      tenantId,
      conversationId,
      configId: config.id,
      runType: 'reply',
      requestPayload: requestBody as Prisma.JsonValue,
      responsePayload: {
        message: aggregatedText,
        toolCalls: toolResults,
      } as Prisma.JsonValue,
      latencyMs: Date.now() - startedAt,
      status: 'aborted',
    });
    return;
  }

  const safeToolResults = toolResults.map((tool) => ({
    ...tool,
    result: tool.result ?? null,
  }));
  sendEvent('done', {
    message: aggregatedText,
    model: modelUsed,
    usage,
    toolCalls: safeToolResults,
    status: completed ? 'success' : 'partial',
  });

  const usagePayload = usage ?? undefined;
  const promptTokens =
    usage && typeof usage === 'object' && usage !== null
      ? (usage as { prompt_tokens?: number }).prompt_tokens ?? null
      : null;
  const completionTokens =
    usage && typeof usage === 'object' && usage !== null
      ? (usage as { completion_tokens?: number }).completion_tokens ?? null
      : null;
  const totalTokens =
    usage && typeof usage === 'object' && usage !== null
      ? (usage as { total_tokens?: number }).total_tokens ?? null
      : null;

  const runResponsePayload = {
    message: aggregatedText,
    toolCalls: safeToolResults,
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
    status: completed ? 'success' : 'partial',
  });

  onComplete?.();
};
