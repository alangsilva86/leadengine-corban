import { useCallback, useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider.jsx';

import useWhatsAppInstances from './useWhatsAppInstances.jsx';
import { useInstancesStore } from '../state/instancesStore';
import { formatRelativeTime, formatWhatsAppNumber } from '../lib/formatting';
import { resolveInstancePhone, looksLikeWhatsAppJid } from '../lib/instances';
import { getInstanceMetrics } from '../lib/metrics';
import { getNumberStatus, type NumberStatus } from '../lib/numberStatus';
import { resolveWhatsAppError, type WhatsAppErrorCopy } from '../lib/errors';

/** Número de WhatsApp pronto para a interface: nada de JID, status cru ou ids. */
export interface WhatsAppNumber {
  id: string;
  name: string;
  /** "+55 11 91234-5678" ou `null` quando o número ainda não foi pareado. */
  phone: string | null;
  status: NumberStatus;
  /** Mensagens enviadas segundo o conector; `null` quando não há dado. */
  sentCount: number | null;
  lastActivityAt: string | null;
  lastActivityLabel: string | null;
  /** Sessões descobertas direto no WhatsApp (sem cadastro) só podem ser desconectadas. */
  isSessionOnly: boolean;
  raw: any;
}

const pickString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const toNumber = (instance: any, qrExpiredId: string | null): WhatsAppNumber => {
  const id = String(instance?.id ?? '');
  const phone = formatWhatsAppNumber(resolveInstancePhone(instance));
  const rawName = pickString(instance?.name, instance?.displayName, instance?.metadata?.displayName);
  // Nunca exibimos o identificador técnico (JID) como nome; nome só com dígitos vira o telefone formatado.
  const nameLooksTechnical =
    !rawName ||
    rawName === instance?.tenantId ||
    looksLikeWhatsAppJid(rawName) ||
    /^\+?\d[\d\s()-]{7,}$/.test(rawName);
  const name = nameLooksTechnical ? phone ?? 'Número sem nome' : (rawName as string);
  const metrics = getInstanceMetrics(instance);
  const hasMetrics = Boolean(instance?.metrics || instance?.stats || instance?.messages);
  const lastActivityAt = pickString(instance?.lastActivity, instance?.lastSeen, instance?.lastSeenAt, instance?.updatedAt);

  return {
    id,
    name,
    phone,
    status: getNumberStatus(instance, { qrExpired: qrExpiredId === id }),
    sentCount: hasMetrics && Number.isFinite(metrics.sent) ? metrics.sent : null,
    lastActivityAt,
    lastActivityLabel: formatRelativeTime(lastActivityAt),
    isSessionOnly: looksLikeWhatsAppJid(id),
    raw: instance,
  };
};

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

export interface UseWhatsAppNumbersResult {
  numbers: WhatsAppNumber[];
  /** Registros crus (para o assistente de regra e diálogos que já os esperam). */
  instances: any[];
  ready: boolean;
  loading: boolean;
  error: WhatsAppErrorCopy | null;
  counts: { total: number; connected: number; needsAttention: number; connecting: number };
  hasConnectedNumber: boolean;
  /** A sessão tem empresa definida: é o que libera a criação de números. */
  canCreate: boolean;
  busyNumberId: string | null;
  refresh: () => Promise<unknown>;
  createNumber: (input: { name: string; id?: string }) => Promise<any>;
  removeNumber: (number: WhatsAppNumber) => Promise<void>;
  disconnectNumber: (number: WhatsAppNumber) => Promise<void>;
  checkStatus: (id: string) => Promise<boolean>;
  wa: ReturnType<typeof useWhatsAppInstances>;
}

/**
 * Lista de números da empresa da sessão, já traduzida para a interface.
 * Não gera QR em segundo plano: o QR só é pedido quando o usuário abre "Conectar número".
 */
const useWhatsAppNumbers = (): UseWhatsAppNumbersResult => {
  const { tenantId } = useAuth();
  const wa = useWhatsAppInstances({ autoGenerateQr: false });
  const qrState = useInstancesStore((state: any) => state.qrState);
  const secondsLeft = useInstancesStore((state: any) => state.secondsLeft);

  const qrExpiredId =
    qrState?.instanceId && qrState?.expiresAt && secondsLeft === 0 ? (qrState.instanceId as string) : null;

  const numbers = useMemo(
    () =>
      (Array.isArray(wa.instances) ? wa.instances : [])
        .filter((instance: any) => instance && typeof instance.id === 'string')
        .map((instance: any) => toNumber(instance, qrExpiredId))
        .sort((a, b) => collator.compare(a.name, b.name)),
    [wa.instances, qrExpiredId],
  );

  const counts = useMemo(() => {
    const totals = { total: numbers.length, connected: 0, needsAttention: 0, connecting: 0 };
    numbers.forEach((number) => {
      if (number.status.isConnected) totals.connected += 1;
      else if (number.status.key === 'connecting') totals.connecting += 1;
      if (number.status.needsAttention) totals.needsAttention += 1;
    });
    return totals;
  }, [numbers]);

  const error = useMemo(() => {
    if (wa.loadStatus !== 'error' || !wa.error) {
      return null;
    }
    return resolveWhatsAppError(
      { message: wa.error.message, code: wa.error.code },
      'Não foi possível carregar seus números',
    );
  }, [wa.error, wa.loadStatus]);

  const refresh = useCallback(() => wa.loadInstances({ forceRefresh: true }), [wa.loadInstances]);

  const createNumber = useCallback(
    async ({ name, id }: { name: string; id?: string }) => {
      const created = await wa.createInstance({ name, id, notify: false });
      const createdId = created?.id ?? id ?? null;
      if (createdId) {
        wa.selectInstance(createdId, { skipAutoQr: true });
      }
      return created;
    },
    [wa.createInstance, wa.selectInstance],
  );

  const removeNumber = useCallback(
    async (number: WhatsAppNumber) => {
      await wa.deleteInstance(number.raw);
    },
    [wa.deleteInstance],
  );

  const disconnectNumber = useCallback(
    async (number: WhatsAppNumber) => {
      if (number.isSessionOnly) {
        // Sessões sem cadastro só existem no WhatsApp: remover = desconectar.
        await wa.deleteInstance(number.raw);
        return;
      }
      await wa.disconnectInstance(number.id);
    },
    [wa.deleteInstance, wa.disconnectInstance],
  );

  return {
    numbers,
    instances: Array.isArray(wa.instances) ? wa.instances : [],
    ready: Boolean(wa.instancesReady) || wa.loadStatus === 'error',
    loading: Boolean(wa.loadingInstances),
    error,
    counts,
    hasConnectedNumber: counts.connected > 0,
    canCreate: Boolean(tenantId),
    busyNumberId: wa.deletingInstanceId ?? null,
    refresh,
    createNumber,
    removeNumber,
    disconnectNumber,
    checkStatus: wa.checkInstanceStatus,
    wa,
  };
};

export default useWhatsAppNumbers;
