import { useCallback, useEffect, useRef, useState } from 'react';
import { buildDefaultApiHeaders, buildUrl } from '@/lib/api.js';
import { buildAiMessagesPayload } from '../utils/aiTimeline.js';

const DEFAULT_AI_MODE = 'IA_AUTO';

const createInitialState = () => ({
  status: 'idle',
  message: '',
  toolCalls: [],
  model: null,
  usage: null,
  error: null,
});

export const useAiReplyStream = () => {
  const [state, setRenderedState] = useState(createInitialState);
  const committedStateRef = useRef(state);
  const abortRef = useRef(null);
  const textRef = useRef('');
  const toolCallMapRef = useRef(new Map());
  const frameRef = useRef(null);

  useEffect(() => {
    committedStateRef.current = state;
  }, [state]);

  const flushState = useCallback(() => {
    frameRef.current = null;
    setRenderedState(committedStateRef.current);
  }, [setRenderedState]);

  const scheduleFlush = useCallback(() => {
    if (frameRef.current !== null) {
      return;
    }
    const raf =
      typeof globalThis.requestAnimationFrame === 'function'
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : (callback) => setTimeout(callback, 16);
    frameRef.current = raf(flushState);
  }, [flushState]);

  useEffect(() => () => {
    if (frameRef.current !== null) {
      const cancel =
        typeof globalThis.cancelAnimationFrame === 'function'
          ? globalThis.cancelAnimationFrame.bind(globalThis)
          : clearTimeout;
      cancel(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const updateState = useCallback(
    (updater) => {
      const nextState =
        typeof updater === 'function' ? updater(committedStateRef.current) : updater;
      committedStateRef.current = nextState;
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = null;
    textRef.current = '';
    toolCallMapRef.current = new Map();
    /* no-op here: watchdog is managed per start */
    updateState(() => createInitialState());
  }, [updateState]);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      /* stream abort triggers watchdog stop in finally */
    }
  }, []);

  const start = useCallback(
    async ({ conversationId, timeline, metadata = {}, mode = DEFAULT_AI_MODE }) => {
      if (!conversationId) {
        throw new Error('conversationId é obrigatório para gerar resposta da IA.');
      }

      const messages = buildAiMessagesPayload(timeline);
      if (messages.length === 0) {
        throw new Error('Não existem mensagens suficientes para gerar uma resposta da IA.');
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;
      textRef.current = '';
      toolCallMapRef.current = new Map();

      updateState(() => ({
        ...createInitialState(),
        status: 'streaming',
      }));

      let watchdogTimer = null;
      const lastActivityRef = { current: Date.now() };
      const resetWatchdog = () => {
        lastActivityRef.current = Date.now();
      };
      const startWatchdog = () => {
        if (watchdogTimer) return;
        watchdogTimer = setInterval(() => {
          const now = Date.now();
          if (now - lastActivityRef.current > 30000) {
            controller.abort();
          }
        }, 5000);
      };
      const stopWatchdog = () => {
        if (watchdogTimer) {
          clearInterval(watchdogTimer);
          watchdogTimer = null;
        }
      };

      try {
        const response = await fetch(buildUrl('/api/ai/reply'), {
          method: 'POST',
          credentials: 'include',
          headers: buildDefaultApiHeaders({
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          }),
          body: JSON.stringify({
            conversationId,
            messages,
            metadata,
            mode,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload = await response.text().catch(() => null);
          throw new Error(payload || `Falha ao iniciar streaming da IA (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finished = false;

        startWatchdog();

        const emitToolCalls = () => {
          const values = Array.from(toolCallMapRef.current.values());
          updateState((prev) => ({
            ...prev,
            toolCalls: values,
          }));
        };

        const handleToolEvent = (event) => {
          resetWatchdog();
          const callId = event?.id ?? event?.tool_call_id ?? event?.call_id;
          if (!callId) return;
          const current = toolCallMapRef.current.get(callId) ?? {
            id: callId,
            name: event?.name ?? null,
            arguments: {},
            status: 'pending',
          };
          if (event?.name) {
            current.name = event.name;
          }
          if (event?.arguments) {
            const nextArgs = (current.arguments?.__raw ?? '') + event.arguments;
            current.arguments = {
              __raw: nextArgs,
            };
            try {
              current.arguments = JSON.parse(nextArgs);
            } catch {
              current.arguments = { __raw: nextArgs };
            }
          }
          toolCallMapRef.current.set(callId, current);
          emitToolCalls();
        };

        const handleToolCompleted = (event) => {
          resetWatchdog();
          const callId = event?.id ?? event?.tool_call_id ?? event?.call_id;
          if (!callId) return;
          const current = toolCallMapRef.current.get(callId) ?? {
            id: callId,
            name: event?.name ?? null,
            arguments: {},
          };
          if (event?.name && !current.name) {
            current.name = event.name;
          }
          current.status = event?.status ?? event?.result?.status ?? 'success';
          if (event?.result?.error || event?.error) {
            current.status = 'error';
            current.error = event?.result?.error ?? event?.error;
          }
          if (event?.result) {
            current.result = event.result;
          }
          toolCallMapRef.current.set(callId, current);
          emitToolCalls();
        };

        const appendText = (delta) => {
          if (!delta) return;
          resetWatchdog();
          textRef.current = `${textRef.current}${delta}`;
          updateState((prev) => ({
            ...prev,
            message: textRef.current,
          }));
        };

        const processEvent = (payload) => {
          const type = payload?.type;
          switch (type) {
            case 'response.output_text.delta':
              appendText(payload?.delta ?? '');
              break;
            case 'response.output_text.done':
              if (payload?.text && (!textRef.current || payload.text.length > textRef.current.length)) {
                appendText(payload.text);
              }
              break;
            case 'response.tool_call.delta':
              handleToolEvent(payload?.delta ?? payload);
              break;
            case 'response.tool_call.completed':
            case 'response.tool_call.done':
              handleToolCompleted(payload);
              break;
            case 'response.completed':
              finished = true;
              updateState((prev) => ({
                ...prev,
                status: 'completed',
                model: payload?.response?.model ?? prev.model,
                usage: payload?.response?.usage ?? prev.usage,
              }));
              stopWatchdog();
              break;
            case 'response.error':
              throw new Error(payload?.error?.message ?? 'Erro ao gerar resposta da IA.');
            default:
              break;
          }
        };

        let done = false;
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) {
            done = true;
          } else {
            buffer += decoder.decode(value, { stream: true });
            resetWatchdog();
            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
              const raw = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const dataLines = raw
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
              for (const line of dataLines) {
                if (!line.startsWith('data:')) continue;
                const dataPayload = line.slice(5).trim();
                if (!dataPayload) continue;
                if (dataPayload === '[DONE]') {
                  finished = true;
                  updateState((prev) => ({
                    ...prev,
                    status: 'completed',
                  }));
                  stopWatchdog();
                  done = true;
                  break;
                }
                try {
                  const parsed = JSON.parse(dataPayload);
                  processEvent(parsed);
                } catch {
                  // ignora fragmentos inválidos
                }
              }
              boundary = buffer.indexOf('\n\n');
            }
          }
        }

        if (!finished) {
          updateState((prev) => ({
            ...prev,
            status: 'completed',
          }));
          stopWatchdog();
        }
      } catch (error) {
        stopWatchdog();
        if (controller.signal.aborted) {
          updateState((prev) => ({
            ...prev,
            status: 'cancelled',
          }));
        } else {
          updateState(() => ({
            status: 'error',
            message: textRef.current,
            toolCalls: Array.from(toolCallMapRef.current.values()),
            model: null,
            usage: null,
            error: error instanceof Error ? error.message : 'Falha ao gerar resposta da IA.',
          }));
        }
      } finally {
        stopWatchdog();
        abortRef.current = null;
      }
    },
    [updateState]
  );

  return {
    ...state,
    start,
    cancel,
    reset,
  };
};

export default useAiReplyStream;
