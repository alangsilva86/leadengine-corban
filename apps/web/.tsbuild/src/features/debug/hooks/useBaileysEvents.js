import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api.js';
const extractStatusCode = (error) => {
    if (!error || typeof error !== 'object')
        return null;
    if (typeof error.status === 'number')
        return error.status ?? null;
    if (typeof error.response?.status === 'number') {
        return error.response?.status ?? null;
    }
    if (typeof error.statusCode === 'number')
        return error.statusCode ?? null;
    if (typeof error.response?.statusCode === 'number') {
        return error.response?.statusCode ?? null;
    }
    return null;
};
const getActionableStatusMessage = (status) => {
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
export const buildBaileysErrorState = (error, previousState) => {
    const status = extractStatusCode(error);
    const fallbackMessage = (error instanceof Error && error.message) ||
        (typeof error?.message === 'string'
            ? error.message
            : null) ||
        'Não foi possível carregar os logs do Baileys.';
    const message = getActionableStatusMessage(status) ?? fallbackMessage;
    const payload = error?.response?.data ?? error?.data ?? previousState?.payload ?? null;
    const requestId = typeof error?.response?.data?.error?.requestId === 'string'
        ? error.response.data.error.requestId
        : typeof error?.data?.error?.requestId === 'string'
            ? error.data.error.requestId
            : typeof payload?.error?.requestId === 'string'
                ? payload.error.requestId
                : null;
    const recoveryHint = typeof error?.response?.data?.error?.recoveryHint === 'string'
        ? error.response.data.error.recoveryHint
        : typeof error?.data?.error?.recoveryHint === 'string'
            ? error.data.error.recoveryHint
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
export const formatDateTime = (value) => {
    if (!value)
        return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }
    return date.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'medium',
    });
};
export const parseBaileysEvents = (payload) => {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (Array.isArray(payload?.data)) {
        return payload.data;
    }
    return [];
};
export const useBaileysEvents = (options = {}) => {
    const { buildQuery, enabled = true, dependencies = [] } = options;
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [degradedMode, setDegradedMode] = useState(false);
    const controllerRef = useRef(null);
    const fetchEvents = useCallback(async (signal) => {
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
        }
        catch (err) {
            if (err?.name === 'AbortError') {
                return;
            }
            setError((previous) => buildBaileysErrorState(err, previous));
            setDegradedMode(true);
            console.error('useBaileysEvents: fetch failed', err);
        }
        finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [buildQuery, enabled]);
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
        if (!enabled)
            return;
        const controller = new AbortController();
        controllerRef.current?.abort();
        controllerRef.current = controller;
        void fetchEvents(controller.signal);
    }, [enabled, fetchEvents]);
    return { events, loading, error, degradedMode, refresh };
};
