import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { apiGet } from '@/lib/api.js';

type ErrorLike = {
  status?: number;
  statusCode?: number;
  response?: { status?: number; statusCode?: number; data?: unknown };
  data?: unknown;
  message?: string;
};

type BaileysErrorState = {
  message: string;
  status: number | null;
  fallbackMessage: string | null;
  payload: unknown;
  timestamp: string;
  requestId: string | null;
  recoveryHint: string | null;
};

type UseBaileysEventsOptions = {
  buildQuery?: () => string;
  enabled?: boolean;
  dependencies?: DependencyList;
};

type BaileysEventsResult = {
  events: any[];
  loading: boolean;
  error: BaileysErrorState | null;
  degradedMode: boolean;
  refresh: () => void;
};

const extractStatusCode = (error: ErrorLike | unknown): number | null => {
  if (!error || typeof error !== 'object') return null;
  if (typeof (error as ErrorLike).status === 'number') return (error as ErrorLike).status ?? null;
  if (typeof (error as ErrorLike).response?.status === 'number') {
    return (error as ErrorLike).response?.status ?? null;
  }
  if (typeof (error as ErrorLike).statusCode === 'number') return (error as ErrorLike).statusCode ?? null;
  if (typeof (error as ErrorLike).response?.statusCode === 'number') {
    return (error as ErrorLike).response?.statusCode ?? null;
  }
  return null;
};

const getActionableStatusMessage = (status: number | null) => {
  switch (status) {
    case 401:
    case 403:
      return 'Sessão expirada (Fase 1) – faça login novamente.';
    case 429:
      return 'Muitas requisições (Fase 2) – aguarde um instante e tente novamente.';
    case 500:
      return 'Erro interno do conector (Fase 3) – tente novamente em alguns instantes ou acione o time responsável.';
    case 502:
    case 503:
    case 504:
      return 'Conector de debug indisponível (Fase 3) – tente novamente em alguns minutos.';
    default:
      return null;
  }
};

export const buildBaileysErrorState = (
  error: ErrorLike | unknown,
  previousState: BaileysErrorState | null
): BaileysErrorState => {
  const status = extractStatusCode(error);
  const fallbackMessage =
    (error instanceof Error && error.message) ||
    (typeof (error as ErrorLike)?.message === 'string'
      ? (error as ErrorLike).message
      : null) ||
    'Não foi possível carregar os logs do Baileys.';
  const message = getActionableStatusMessage(status) ?? fallbackMessage;
  const payload =
    (error as ErrorLike)?.response?.data ?? (error as ErrorLike)?.data ?? previousState?.payload ?? null;
  const requestId =
    typeof (error as ErrorLike)?.response?.data?.error?.requestId === 'string'
      ? (error as any).response.data.error.requestId
      : typeof (error as any)?.data?.error?.requestId === 'string'
        ? (error as any).data.error.requestId
        : typeof (payload as any)?.error?.requestId === 'string'
          ? (payload as any).error.requestId
          : null;
  const recoveryHint =
    typeof (error as ErrorLike)?.response?.data?.error?.recoveryHint === 'string'
      ? ((error as any).response.data.error.recoveryHint as string)
      : typeof (error as any)?.data?.error?.recoveryHint === 'string'
        ? (error as any).data.error.recoveryHint
        : null;

  return {
    message,
    status,
    fallbackMessage,
    payload,
    timestamp: new Date().toISOString(),
    requestId,
    recoveryHint,
  };
};

export const formatDateTime = (value: unknown) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
};

export const parseBaileysEvents = (payload: unknown): any[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray((payload as any)?.data)) {
    return (payload as any).data;
  }
  return [];
};

export const useBaileysEvents = (options: UseBaileysEventsOptions = {}): BaileysEventsResult => {
  const { buildQuery, enabled = true, dependencies = [] } = options;
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<BaileysErrorState | null>(null);
  const [degradedMode, setDegradedMode] = useState<boolean>(false);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchEvents = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled || signal?.aborted) {
        return;
      }

      setLoading(true);

      try {
        const queryString = buildQuery?.() ?? '';
        const endpoint = queryString
          ? `/api/debug/baileys-events?${queryString}`
          : '/api/debug/baileys-events';
        const response = await apiGet(endpoint, { signal });
        const items = parseBaileysEvents(response?.data ?? response);
        setEvents(items);
        setError(null);
        setDegradedMode(false);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') {
          return;
        }
        setError((previous) => buildBaileysErrorState(err, previous));
        setDegradedMode(true);
        console.error('useBaileysEvents: fetch failed', err);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [buildQuery, enabled]
  );

  useEffect(() => {
    if (!enabled) {
      setEvents([]);
      setError(null);
      setDegradedMode(false);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    void fetchEvents(controller.signal);

    return () => {
      controller.abort();
    };
  }, [enabled, fetchEvents, ...dependencies]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    void fetchEvents(controller.signal);
  }, [enabled, fetchEvents]);

  return { events, loading, error, degradedMode, refresh };
};

export type { BaileysErrorState };
