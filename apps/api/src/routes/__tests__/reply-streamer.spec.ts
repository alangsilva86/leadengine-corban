import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReplyStreamer } from '../reply-streamer';

const buildLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => buildLogger()),
  level: 'info',
});

const baseOptions = () => {
  const abortController = new AbortController();
  return {
    tenantId: 'tenant-1',
    conversationId: 'conversation-1',
    configId: 'config-1',
    model: 'gpt-4o-mini',
    requestPayload: {},
    responsesApiUrl: 'https://api.openai.com/v1/responses',
    apiKey: 'test-key',
    signal: abortController.signal,
    logger: buildLogger(),
    toolTimeoutMs: 100,
    toolMaxRetries: 0,
    toolMaxConcurrency: 2,
    toolRetryDelayMs: 10,
  } as const;
};

describe('ReplyStreamer', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.resetAllMocks();
  });

  it('continues emitting deltas while executing tools in the background', async () => {
    const events: Array<{ event: string; data: any }> = [];
    const sendEvent = vi.fn((event: string, data: any) => {
      events.push({ event, data });
    });

    const executeTool = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { ok: true, result: { ok: true } };
    });

    const recordAiRun = vi.fn(async () => ({ id: 'run-1' }));
    const fetchImpl = vi.fn(async () => ({ ok: true, text: async () => '', json: async () => ({}) }));

    const streamer = new ReplyStreamer({
      ...baseOptions(),
      sendEvent,
      executeTool,
      recordAiRun,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    streamer.handleEvent({
      type: 'response.output_text.delta',
      delta: { type: 'output_text.delta', text: 'Olá' },
    });
    streamer.handleEvent({
      type: 'response.tool_call.delta',
      delta: { id: 'call_1', name: 'lookup', arguments: '{"value":1}' },
    });
    streamer.handleEvent({
      type: 'response.tool_call.completed',
      id: 'call_1',
      response: { id: 'resp_123' },
    });
    streamer.handleEvent({
      type: 'response.output_text.delta',
      delta: { type: 'output_text.delta', text: ' mundo' },
    });
    streamer.handleEvent({
      type: 'response.output_text.done',
      output_text: { type: 'output_text', text: 'Olá mundo' },
    });
    streamer.handleEvent({
      type: 'response.completed',
      response: {
        model: 'gpt-4o-mini',
        usage: { prompt_tokens: 5, completion_tokens: 5 },
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Olá mundo' }],
          },
        ],
      },
    });

    const deltaEvents = events.filter((entry) => entry.event === 'delta');
    expect(deltaEvents.map((entry) => entry.data.delta)).toEqual(['Olá', ' mundo']);

    await vi.waitFor(() => {
      const successEvent = events.find(
        (entry) => entry.event === 'tool_call' && entry.data.status === 'success'
      );
      expect(successEvent).toBeDefined();
    });

    const summary = await streamer.finalize();
    expect(summary.message).toBe('Olá mundo');
    expect(summary.toolCalls).toHaveLength(1);
    expect(summary.toolCalls[0]).toMatchObject({ status: 'success', name: 'lookup' });

    expect(recordAiRun).toHaveBeenCalledWith(
      expect.objectContaining({ runType: 'tool_call', status: 'success' })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/resp_123/tool_outputs'),
      expect.objectContaining({ method: 'POST' })
    );

    const deltaIndex = events.findIndex((entry) => entry.event === 'delta');
    const successIndex = events.findIndex(
      (entry) => entry.event === 'tool_call' && entry.data.status === 'success'
    );
    expect(deltaIndex).toBeGreaterThan(-1);
    expect(successIndex).toBeGreaterThan(deltaIndex);
  });

  it('retries tool execution on timeout before emitting an error', async () => {
    vi.useFakeTimers();

    const events: Array<{ event: string; data: any }> = [];
    const sendEvent = vi.fn((event: string, data: any) => {
      events.push({ event, data });
    });

    let attempt = 0;
    const executeTool = vi.fn(() => {
      attempt += 1;
      if (attempt === 1) {
        return new Promise<never>(() => {});
      }
      return Promise.resolve({ ok: true, result: { attempt } });
    });

    const recordAiRun = vi.fn(async () => ({ id: 'run-1' }));

    const streamer = new ReplyStreamer({
      ...baseOptions(),
      sendEvent,
      executeTool,
      recordAiRun,
      toolTimeoutMs: 50,
      toolMaxRetries: 1,
      toolRetryDelayMs: 20,
      apiKey: null,
    });

    streamer.handleEvent({
      type: 'response.tool_call.delta',
      delta: { id: 'call_retry', name: 'lookup', arguments: '{}' },
    });
    streamer.handleEvent({
      type: 'response.tool_call.done',
      id: 'call_retry',
      response: { id: 'resp_retry' },
    });

    await vi.advanceTimersByTimeAsync(55);

    const retryEvent = events.find(
      (entry) => entry.event === 'tool_call' && entry.data.status === 'retrying'
    );
    expect(retryEvent).toBeDefined();

    await vi.advanceTimersByTimeAsync(25);
    await vi.advanceTimersByTimeAsync(10);

    await vi.runAllTimersAsync();
    await streamer.finalize();

    expect(executeTool).toHaveBeenCalledTimes(2);

    const successEvent = events.find(
      (entry) => entry.event === 'tool_call' && entry.data.status === 'success'
    );
    expect(successEvent).toBeDefined();

    const runCall = recordAiRun.mock.calls.find((call) => call[0].runType === 'tool_call');
    expect(runCall?.[0].status).toBe('success');

    vi.useRealTimers();
  });
});
