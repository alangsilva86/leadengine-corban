import { useCallback, useRef, useState } from 'react';
import { buildDefaultApiHeaders, buildUrl } from '@/lib/api.js';

const parseMessageRole = (value) => {
  if (!value) return 'user';
  const normalized = String(value).trim().toLowerCase();
  if (['assistant', 'agent', 'outbound', 'auto'].includes(normalized)) {
    return 'assistant';
  }
  if (['system'].includes(normalized)) {
    return 'system';
  }
  return 'user';
};

const initialState = {
  status: 'idle',
  message: '',
  toolCalls: [],
  model: null,
  usage: null,
  error: null,
};

const buildMessagesPayload = (items = []) =>
  items
    .map((entry) => {
      if (!entry) return null;
      const payload = entry.payload ?? entry;
      if (!payload) return null;
      const content =
        payload.content ?? payload.text ?? payload.body ?? payload.message ?? payload.messageText;
      if (!content || typeof content !== 'string') {
        return null;
      }
      const role = parseMessageRole(payload.role ?? payload.direction ?? payload.authorRole);
      return {
        role,
        content,
      };
    })
    .filter(Boolean);

export const useAiReplyStream = () => {
  const [state, setState] = useState(initialState);
  const abortRef = useRef(null);
  const textRef = useRef('');
  const toolCallMapRef = useRef(new Map());

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = null;
    textRef.current = '';
    toolCallMapRef.current = new Map();
    setState(initialState);
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const start = useCallback(
    async ({ conversationId, timeline, metadata = {} }) => {
      if (!conversationId) {
        throw new Error('conversationId é obrigatório para gerar resposta da IA.');
      }

      const messages = buildMessagesPayload(timeline);
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

      setState({
        status: 'streaming',
        message: '',
        toolCalls: [],
        model: null,
        usage: null,
        error: null,
      });

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

        const emitToolCalls = () => {
          const values = Array.from(toolCallMapRef.current.values());
          setState((prev) => ({
            ...prev,
            toolCalls: values,
          }));
        };

        const handleToolEvent = (event) => {
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
          textRef.current = `${textRef.current}${delta}`;
          setState((prev) => ({
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
              setState((prev) => ({
                ...prev,
                status: 'completed',
                model: payload?.response?.model ?? prev.model,
                usage: payload?.response?.usage ?? prev.usage,
              }));
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
          setState((prev) => ({
            ...prev,
            status: 'completed',
          }));
        }
      } catch (error) {
        if (controller.signal.aborted) {
          setState((prev) => ({
            ...prev,
            status: 'cancelled',
          }));
        } else {
          setState({
            status: 'error',
            message: textRef.current,
            toolCalls: Array.from(toolCallMapRef.current.values()),
            model: null,
            usage: null,
            error: error instanceof Error ? error.message : 'Falha ao gerar resposta da IA.',
          });
        }
      } finally {
        abortRef.current = null;
      }
    },
    []
  );

  return {
    ...state,
    start,
    cancel,
    reset,
  };
};

export default useAiReplyStream;
