import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { Logger } from 'pino';
import type { AiToolExecutionResult } from '../services/ai/tool-registry';

type ExecuteTool = (
  name: string,
  params: Record<string, unknown>,
  context: { tenantId: string; conversationId: string }
) => Promise<AiToolExecutionResult>;

type RecordAiRun = (input: {
  tenantId: string;
  conversationId: string;
  configId?: string | null;
  runType: string;
  requestPayload: Prisma.JsonValue;
  responsePayload?: Prisma.JsonValue | null;
  status?: string;
  latencyMs?: number | null;
}) => Promise<unknown>;

type SendEvent = (event: string, data: unknown) => void;

type ToolAccumulator = {
  id: string;
  name: string | null;
  argsChunks: string[];
  responseId: string | null;
};

type ToolResult = {
  id: string;
  taskId: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  result?: unknown;
  error?: string;
};

type ReplyStreamerOptions = {
  tenantId: string;
  conversationId: string;
  configId: string;
  model: string;
  requestPayload: Record<string, unknown>;
  sendEvent: SendEvent;
  executeTool: ExecuteTool;
  recordAiRun: RecordAiRun;
  responsesApiUrl: string;
  apiKey?: string | null;
  signal: AbortSignal;
  logger: Logger;
  toolTimeoutMs: number;
  toolMaxRetries: number;
  toolMaxConcurrency: number;
  toolRetryDelayMs: number;
  fetchImpl?: typeof fetch;
};

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

class AsyncQueue {
  private active = 0;
  private readonly queue: Array<() => Promise<void>> = [];
  private readonly idleResolvers = new Set<() => void>();
  private cancelled = false;

  constructor(private readonly concurrency: number) {}

  enqueue(task: () => Promise<void>): void {
    if (this.cancelled) {
      return;
    }
    this.queue.push(task);
    this.process();
  }

  cancel(): void {
    this.cancelled = true;
    this.queue.length = 0;
    this.resolveIdle();
  }

  async waitForIdle(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.idleResolvers.add(resolve);
    });
  }

  private process(): void {
    if (this.cancelled) {
      return;
    }
    while (this.active < this.concurrency) {
      const task = this.queue.shift();
      if (!task) {
        if (this.active === 0) {
          this.resolveIdle();
        }
        return;
      }
      this.active += 1;
      Promise.resolve()
        .then(task)
        .catch(() => {
          // Errors are handled within each task. Avoid unhandled rejections.
        })
        .finally(() => {
          this.active -= 1;
          if (this.queue.length === 0 && this.active === 0) {
            this.resolveIdle();
          }
          this.process();
        });
    }
  }

  private resolveIdle(): void {
    for (const resolve of this.idleResolvers) {
      resolve();
    }
    this.idleResolvers.clear();
  }
}

export class ReplyStreamer {
  private readonly toolBuilders = new Map<string, ToolAccumulator>();
  private readonly executedCalls = new Set<string>();
  private readonly queue: AsyncQueue;
  private readonly fetchImpl: typeof fetch;
  private readonly toolResults: ToolResult[] = [];
  private aborted = false;
  private aggregatedText = '';
  private completed = false;
  private usage: Record<string, unknown> | null = null;
  private modelUsed: string;

  constructor(private readonly options: ReplyStreamerOptions) {
    const concurrency = Math.max(1, options.toolMaxConcurrency);
    this.queue = new AsyncQueue(concurrency);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.modelUsed = options.model;

    options.signal.addEventListener('abort', () => {
      this.aborted = true;
      this.queue.cancel();
    });
  }

  handleEvent(payload: any): void {
    const type = payload?.type;
    switch (type) {
      case 'response.error':
        throw new Error(payload?.error?.message ?? 'Erro na resposta da IA');
      case 'response.output_text.delta':
        this.handleOutputDelta(payload?.delta ?? '');
        break;
      case 'response.output_text.done':
        this.handleOutputDone(payload);
        break;
      case 'response.tool_call.delta':
        this.handleToolDelta(payload?.delta ?? payload);
        break;
      case 'response.tool_call.completed':
      case 'response.tool_call.done':
        this.handleToolCompleted(payload);
        break;
      case 'response.completed':
        this.completed = true;
        this.modelUsed = payload?.response?.model ?? this.modelUsed;
        this.usage = (payload?.response?.usage as Record<string, unknown>) ?? this.usage;
        break;
      default:
        break;
    }
  }

  getSummary(): {
    message: string;
    model: string;
    usage: Record<string, unknown> | null;
    completed: boolean;
    toolCalls: ToolResult[];
  } {
    return {
      message: this.aggregatedText,
      model: this.modelUsed,
      usage: this.usage,
      completed: this.completed,
      toolCalls: this.toolResults.map((tool) => ({
        ...tool,
        result: tool.result ?? null,
      })),
    };
  }

  async finalize(): Promise<{
    message: string;
    model: string;
    usage: Record<string, unknown> | null;
    completed: boolean;
    toolCalls: ToolResult[];
  }> {
    await this.queue.waitForIdle();
    return this.getSummary();
  }

  private handleOutputDelta(delta: string): void {
    if (typeof delta === 'string' && delta.length > 0) {
      this.aggregatedText += delta;
      this.options.sendEvent('delta', { delta });
    }
  }

  private handleOutputDone(payload: any): void {
    const text = payload?.text;
    if (typeof text === 'string' && text.length > this.aggregatedText.length) {
      this.aggregatedText = text;
    }
  }

  private handleToolDelta(payload: any): void {
    if (!payload) {
      return;
    }
    const callId = payload?.id ?? payload?.tool_call_id ?? payload?.call_id;
    if (!callId) {
      return;
    }
    const builder =
      this.toolBuilders.get(callId) ??
      ({
        id: callId,
        name: payload?.name ?? null,
        argsChunks: [],
        responseId: payload?.response?.id ?? payload?.response_id ?? null,
      } as ToolAccumulator);

    if (payload?.name) {
      builder.name = payload.name;
    }
    if (payload?.response?.id || payload?.response_id) {
      builder.responseId = payload?.response?.id ?? payload?.response_id ?? null;
    }
    if (payload?.arguments) {
      builder.argsChunks.push(String(payload.arguments));
    }

    this.toolBuilders.set(callId, builder);
  }

  private handleToolCompleted(payload: any): void {
    const callId = payload?.id ?? payload?.tool_call_id ?? payload?.call_id;
    if (!callId || this.executedCalls.has(callId)) {
      return;
    }

    const builder = this.toolBuilders.get(callId);
    if (!builder) {
      this.options.logger.warn('crm.ai.reply.tool.missing_builder', { callId });
      return;
    }

    this.executedCalls.add(callId);
    this.toolBuilders.delete(callId);
    const name = builder.name;
    const argsText = builder.argsChunks.join('');
    let parsedArgs: Record<string, unknown> = {};
    if (argsText) {
      try {
        parsedArgs = JSON.parse(argsText);
      } catch (error) {
        this.options.logger.warn('crm.ai.reply.tool.arguments_parse_failed', {
          callId,
          error,
        });
      }
    }

    const responseId =
      payload?.response?.id ?? payload?.response_id ?? builder.responseId ?? null;
    const taskId = randomUUID();

    const baseEvent = {
      id: callId,
      taskId,
      name: name ?? 'unknown_tool',
      arguments: parsedArgs,
    };

    this.options.sendEvent('tool_call', {
      ...baseEvent,
      status: 'queued',
    });

    this.queue.enqueue(async () => {
      await this.executeToolTask({
        callId,
        taskId,
        name,
        args: parsedArgs,
        responseId,
      });
    });
  }

  private async executeToolTask(params: {
    callId: string;
    taskId: string;
    name: string | null;
    args: Record<string, unknown>;
    responseId: string | null;
  }): Promise<void> {
    const { callId, taskId, name, args, responseId } = params;

    if (!name) {
      this.options.logger.warn('crm.ai.reply.tool.missing_name', { callId });
      return;
    }

    if (this.aborted) {
      return;
    }

    const baseEvent = {
      id: callId,
      taskId,
      name,
      arguments: args,
    };

    const startTime = Date.now();
    this.options.sendEvent('tool_call', { ...baseEvent, status: 'executing' });

    const maxAttempts = Math.max(1, this.options.toolMaxRetries + 1);
    let attempt = 0;
    let finalResult: AiToolExecutionResult | null = null;
    let finalStatus: ToolResult['status'] = 'error';
    let lastErrorMessage = 'unknown_error';
    let timeoutOccurred = false;

    while (attempt < maxAttempts && !this.aborted) {
      attempt += 1;
      try {
        const execution = await this.withTimeout(() =>
          this.options.executeTool(name, args, {
            tenantId: this.options.tenantId,
            conversationId: this.options.conversationId,
          })
        );

        if (execution.ok) {
          finalResult = execution;
          finalStatus = 'success';
          break;
        }

        finalResult = execution;
        lastErrorMessage = execution.error ?? 'unknown_error';
      } catch (error) {
        if (error instanceof TimeoutError) {
          timeoutOccurred = true;
          lastErrorMessage = error.message;
        } else {
          lastErrorMessage = (error as Error)?.message ?? 'unknown_error';
        }
      }

      if (attempt < maxAttempts && !this.aborted) {
        this.options.sendEvent('tool_call', {
          ...baseEvent,
          status: 'retrying',
          attempt,
          remainingAttempts: maxAttempts - attempt,
        });
        await this.delay(this.options.toolRetryDelayMs);
      }
    }

    if (this.aborted) {
      return;
    }

    if (finalStatus !== 'success') {
      finalStatus = timeoutOccurred ? 'timeout' : 'error';
    }

    const duration = Date.now() - startTime;

    const toolRecord: ToolResult = {
      ...baseEvent,
      status: finalStatus,
      result: finalResult?.result,
      error: finalStatus === 'success' ? undefined : lastErrorMessage,
    };

    this.toolResults.push(toolRecord);

    await this.recordToolRun({
      tool: toolRecord,
      duration,
      responseId,
    });

    this.options.sendEvent('tool_call', {
      ...toolRecord,
    });
  }

  private async recordToolRun(params: {
    tool: ToolResult;
    duration: number;
    responseId: string | null;
  }): Promise<void> {
    const { tool, duration, responseId } = params;

    try {
      await this.options.recordAiRun({
        tenantId: this.options.tenantId,
        conversationId: this.options.conversationId,
        configId: this.options.configId,
        runType: 'tool_call',
        requestPayload: {
          name: tool.name,
          arguments: tool.arguments as unknown as Prisma.JsonValue,
          taskId: tool.taskId,
        } as Prisma.JsonValue,
        responsePayload:
          tool.status === 'success'
            ? ((tool.result ?? null) as unknown as Prisma.JsonValue)
            : ({ error: tool.error ?? 'unknown_error' } as Prisma.JsonValue),
        status: tool.status,
        latencyMs: duration,
      });
    } catch (error) {
      this.options.logger.warn('crm.ai.reply.tool.record_failed', {
        tool: tool.name,
        error,
      });
    }

    if (tool.status === 'success' && responseId && this.options.apiKey) {
      await this.submitToolOutput(responseId, tool);
    }
  }

  private async submitToolOutput(responseId: string, tool: ToolResult): Promise<void> {
    try {
      const response = await this.fetchImpl(`${this.options.responsesApiUrl}/${responseId}/tool_outputs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          tool_outputs: [
            {
              tool_call_id: tool.id,
              output:
                typeof tool.result === 'string'
                  ? tool.result
                  : JSON.stringify(tool.result === undefined ? null : tool.result),
            },
          ],
        }),
      });

      if (!response.ok) {
        const payload = await response.text().catch(() => null);
        this.options.logger.warn('crm.ai.reply.tool.submit_failed', {
          responseId,
          toolCallId: tool.id,
          status: response.status,
          payload,
        });
      }
    } catch (error) {
      this.options.logger.warn('crm.ai.reply.tool.submit_failed', {
        responseId,
        toolCallId: tool.id,
        error,
      });
    }
  }

  private async withTimeout<T>(factory: () => Promise<T>): Promise<T> {
    if (!Number.isFinite(this.options.toolTimeoutMs) || this.options.toolTimeoutMs <= 0) {
      return factory();
    }

    let timeoutId: NodeJS.Timeout | null = null;

    try {
      return await Promise.race([
        factory(),
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new TimeoutError(`Ferramenta expirou após ${this.options.toolTimeoutMs}ms`));
          }, this.options.toolTimeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
