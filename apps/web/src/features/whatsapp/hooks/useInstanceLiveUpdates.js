import { useRealtimeConnection, useRealtimeEvent } from '@/lib/realtime/useRealtime.js';

/**
 * Eventos do backend → tipo simplificado entregue aos consumidores.
 * A API emite `whatsapp.instances.*` (created/deleted/synced); os nomes no singular são mantidos
 * para compatibilidade com conectores que publiquem eventos por número.
 */
const EVENT_TYPE_MAP = {
  'whatsapp.instances.created': 'created',
  'whatsapp.instances.deleted': 'removed',
  'whatsapp.instances.synced': 'synced',
  'whatsapp.instance.updated': 'updated',
  'whatsapp.instance.created': 'created',
  'whatsapp.instance.removed': 'removed',
  'whatsapp.instance.qr': 'qr',
};

/** `whatsapp.instances.created` chega como `{ instance: {...} }`; os consumidores esperam o número no topo. */
const normalizePayload = (event, payload) => {
  if (event === 'whatsapp.instances.created' && payload && typeof payload === 'object' && payload.instance) {
    return { ...payload.instance, ...payload, instance: undefined };
  }
  return payload;
};

const INSTANCE_EVENTS = Object.keys(EVENT_TYPE_MAP);

/**
 * Atualizações em tempo real das instâncias do WhatsApp, sobre a conexão compartilhada
 * (`@/lib/realtime`). A sala do tenant é derivada da sessão pelo servidor.
 */
const useInstanceLiveUpdates = ({ tenantId, enabled = true, onEvent }) => {
  const active = typeof window !== 'undefined' && enabled && Boolean(tenantId);
  const connection = useRealtimeConnection({ enabled: active });

  useRealtimeEvent(
    INSTANCE_EVENTS,
    (payload, event) => {
      if (typeof onEvent === 'function') {
        onEvent({ type: EVENT_TYPE_MAP[event], payload: normalizePayload(event, payload) });
      }
    },
    { enabled: active }
  );

  return {
    connected: connection.connected,
    connectionError: connection.error,
  };
};

export default useInstanceLiveUpdates;
