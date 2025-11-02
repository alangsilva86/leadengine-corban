/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const buildHeadersMock = vi.fn(() => ({
  'Content-Type': 'application/json',
  Accept: 'text/event-stream',
}));
const buildUrlMock = vi.fn((path) => path);

vi.mock('@/lib/api.js', () => ({
  buildDefaultApiHeaders: (...args) => buildHeadersMock(...args),
  buildUrl: (...args) => buildUrlMock(...args),
}));

describe('useAiReplyStream', () => {
  let originalFetch;
  let timelineUtils;
  let useAiReplyStream;
  let buildMessagesSpy;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    const readerMock = {
      read: vi.fn().mockResolvedValue({ value: undefined, done: true }),
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => readerMock,
      },
    });

    timelineUtils = await import('../../utils/aiTimeline.js');
    buildMessagesSpy = vi.spyOn(timelineUtils, 'buildAiMessagesPayload');
    ({ useAiReplyStream } = await import('../useAiReplyStream.js'));
  });

  afterEach(() => {
    buildHeadersMock.mockClear();
    buildUrlMock.mockClear();
    buildMessagesSpy.mockRestore();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete globalThis.fetch;
    }
    vi.resetModules();
  });

  it('constrói o payload de mensagens com a utilidade compartilhada', async () => {
    const timeline = [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `entry-${index + 1}`,
        payload: {
          content: `Mensagem ${index + 1}`,
          role: index % 2 === 0 ? 'outbound' : 'inbound',
        },
      })),
      { payload: { content: null } },
    ];

    const { result } = renderHook(() => useAiReplyStream());

    await act(async () => {
      await result.current.start({
        conversationId: 'conv-1',
        timeline,
        metadata: { ticketId: 'ticket-1' },
      });
    });

    expect(buildMessagesSpy).toHaveBeenCalledWith(timeline);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/ai/reply');
    expect(buildHeadersMock).toHaveBeenCalled();
    const body = JSON.parse(init.body);
    expect(body.conversationId).toBe('conv-1');
    expect(body.metadata).toEqual({ ticketId: 'ticket-1' });
    expect(body.messages).toEqual(timelineUtils.buildAiMessagesPayload(timeline));
  });
});
