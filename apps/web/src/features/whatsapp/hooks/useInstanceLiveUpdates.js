import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/api.js';

/**
 * Resolve a base URL that works both with SSR and in-browser.
 * Falls back to window.origin in the browser if API_BASE_URL is not defined.
 */
const resolveSocketUrl = () => {
  if (typeof window === 'undefined') {
    return API_BASE_URL || '';
  }
  return API_BASE_URL || window.location.origin || '';
};

/**
 * Map of backend events to a simplified event type for consumers.
 */
const EVENT_TYPE_MAP = {
  'whatsapp.instance.updated': 'updated',
  'whatsapp.instance.created': 'created',
  'whatsapp.instance.removed': 'removed',
  'whatsapp.instance.qr': 'qr',
};

/**
 * Hook de atualizações em tempo real das instâncias do WhatsApp.
 *
 * Melhorias aplicadas:
 * - Evita múltiplas conexões e ouvintes duplicados ao remover `onEvent` do array de dependências
 *   e usar um `callbackRef` estável.
 * - Limpeza rigorosa dos listeners e do socket na desmontagem ou troca de tenant.
 * - Backoff de reconexão menos agressivo para reduzir tempestades de conexão.
 * - Join do tenant com ACK para depuração de erro de sala.
 * - Guardas SSR e de `enabled/tenantId` para não iniciar quando não for necessário.
 */
const useInstanceLiveUpdates = ({ tenantId, enabled = true, onEvent }) => {
  const socketRef = useRef(null);
  const callbackRef = useRef(onEvent);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Mantém a referência do callback sempre atual sem reexecutar o efeito principal.
  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    // Não conecta no SSR ou se desabilitado/sem tenant
    if (typeof window === 'undefined' || !enabled || !tenantId) {
      return undefined;
    }

    let isActive = true;

    const connect = async () => {
      try {
        const { io } = await import('socket.io-client');
        if (!isActive) return;

        const url = resolveSocketUrl();
        if (!url) {
          setConnectionError('Base URL do socket indefinida.');
          return;
        }

        // Garante nova instância e backoff razoável
        const socket = io(url, {
          path: '/socket.io',
          transports: ['websocket', 'polling'],
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 8000,
          timeout: 10000,
          forceNew: true,
          query: { tenantId }, // ajuda o backend a contextualizar a conexão
        });

        socketRef.current = socket;

        // Handlers nomeados para permitir "off" na limpeza
        const handleConnected = () => {
          if (!isActive) return;
          setConnected(true);
          setConnectionError(null);

          // Reentra na sala com ACK para confirmar ingresso
          socket.emit('join-tenant', { tenantId }, (ack) => {
            if (!ack || ack.ok !== true) {
              setConnectionError(
                (ack && ack.error) || 'Falha ao ingressar na sala do tenant'
              );
            }
          });
        };

        const handleDisconnected = () => {
          if (!isActive) return;
          setConnected(false);
        };

        const handleConnectError = (error) => {
          if (!isActive) return;
          const message =
            error instanceof Error ? error.message : 'Falha ao conectar no tempo real';
          setConnectionError(message);
        };

        const handleReconnectFailed = () => {
          if (!isActive) return;
          setConnectionError(
            'Não foi possível restabelecer conexão em tempo real após várias tentativas.'
          );
        };

        socket.on('connect', handleConnected);
        socket.on('disconnect', handleDisconnected);
        socket.on('connect_error', handleConnectError);
        socket.on('reconnect_failed', handleReconnectFailed);

        // Registrar listeners dos eventos de instância
        const registered = [];
        Object.entries(EVENT_TYPE_MAP).forEach(([eventName, type]) => {
          const handler = (payload) => {
            const cb = callbackRef.current;
            if (typeof cb === 'function') {
              cb({ type, payload });
            }
          };
          socket.on(eventName, handler);
          registered.push([eventName, handler]);
        });

        // Função de teardown local para remover listeners
        const teardown = () => {
          try {
            registered.forEach(([evt, fn]) => socket.off(evt, fn));
            socket.off('connect', handleConnected);
            socket.off('disconnect', handleDisconnected);
            socket.off('connect_error', handleConnectError);
            socket.off('reconnect_failed', handleReconnectFailed);
            socket.close();
          } catch {
            // ignora erros de cleanup
          }
        };

        // Guarda o teardown no ref para uso no cleanup externo
        socketRef.current.__teardown__ = teardown;
      } catch (error) {
        if (!isActive) return;
        const message =
          error instanceof Error ? error.message : 'Falha ao carregar socket.io-client';
        setConnectionError(message);
      }
    };

    connect();

    return () => {
      isActive = false;
      const socket = socketRef.current;
      if (socket) {
        try {
          if (typeof socket.__teardown__ === 'function') {
            socket.__teardown__();
          } else {
            socket.close();
          }
        } finally {
          socketRef.current = null;
        }
      }
    };
  }, [enabled, tenantId]); // intencionalmente sem `onEvent` para evitar reconexões e ouvintes duplicados

  return {
    connected,
    connectionError,
  };
};

export default useInstanceLiveUpdates;
