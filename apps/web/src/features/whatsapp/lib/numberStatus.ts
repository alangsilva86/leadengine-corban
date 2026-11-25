import { normalizeWhatsAppStatus } from '@leadengine/wa-status';

/**
 * Modelo único de status de um número de WhatsApp.
 *
 * Toda a interface (lista, detalhes, regras, assistente) deve passar por aqui:
 * nenhum status cru do conector ("qr_required", "pending", "failed"…) aparece na tela.
 */

export type NumberStatusKey =
  | 'connected'
  | 'connecting'
  | 'pairing'
  | 'qr_expired'
  | 'disconnected'
  | 'error';

export type NumberStatusTone = 'success' | 'info' | 'warning' | 'neutral' | 'danger';

/** Ação principal sugerida para o status (o que o botão da linha faz). */
export type NumberStatusAction = 'details' | 'connect' | 'regenerate-qr' | 'reconnect' | 'retry' | null;

export interface NumberStatus {
  key: NumberStatusKey;
  label: string;
  tone: NumberStatusTone;
  actionLabel: string | null;
  action: NumberStatusAction;
  /** Frase curta para quem não sabe o que o status significa. */
  description: string;
  /** Conta em "precisa de atenção". */
  needsAttention: boolean;
  isConnected: boolean;
  /** Mostra spinner no lugar do ponto de status. */
  isBusy: boolean;
}

const STATUS_TABLE: Record<NumberStatusKey, Omit<NumberStatus, 'key'>> = {
  connected: {
    label: 'Conectado',
    tone: 'success',
    actionLabel: 'Ver detalhes',
    action: 'details',
    description: 'Recebendo e enviando mensagens normalmente.',
    needsAttention: false,
    isConnected: true,
    isBusy: false,
  },
  connecting: {
    label: 'Conectando…',
    tone: 'info',
    actionLabel: null,
    action: null,
    description: 'Estamos estabelecendo a conexão. Isso leva alguns segundos.',
    needsAttention: false,
    isConnected: false,
    isBusy: true,
  },
  pairing: {
    label: 'Aguardando pareamento',
    tone: 'warning',
    actionLabel: 'Conectar',
    action: 'connect',
    description: 'Leia o QR Code ou use o código no celular para concluir a conexão.',
    needsAttention: true,
    isConnected: false,
    isBusy: false,
  },
  qr_expired: {
    label: 'QR expirado',
    tone: 'warning',
    actionLabel: 'Gerar novo QR',
    action: 'regenerate-qr',
    description: 'O código expirou antes da leitura. Gere um novo para continuar.',
    needsAttention: true,
    isConnected: false,
    isBusy: false,
  },
  disconnected: {
    label: 'Desconectado',
    tone: 'neutral',
    actionLabel: 'Reconectar',
    action: 'reconnect',
    description: 'Este número não está recebendo mensagens. Reconecte para voltar a atender.',
    needsAttention: true,
    isConnected: false,
    isBusy: false,
  },
  error: {
    label: 'Erro de conexão',
    tone: 'danger',
    actionLabel: 'Tentar novamente',
    action: 'retry',
    description: 'Não conseguimos manter a conexão com o WhatsApp. Tente conectar de novo.',
    needsAttention: true,
    isConnected: false,
    isBusy: false,
  },
};

const NORMALIZED_TO_KEY: Record<string, NumberStatusKey> = {
  connected: 'connected',
  connecting: 'connecting',
  reconnecting: 'connecting',
  qr_required: 'pairing',
  pending: 'pairing',
  disconnected: 'disconnected',
  failed: 'error',
  error: 'error',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const readRawStatus = (instance: unknown): string | null => {
  if (typeof instance === 'string') {
    return instance;
  }
  if (!isRecord(instance)) {
    return null;
  }
  const { status } = instance;
  if (typeof status === 'string') {
    return status;
  }
  if (isRecord(status)) {
    if (typeof status.current === 'string') return status.current;
    if (typeof status.status === 'string') return status.status;
  }
  return null;
};

const readQrReason = (instance: unknown): string | null => {
  if (!isRecord(instance)) {
    return null;
  }
  const metadata = isRecord(instance.metadata) ? instance.metadata : {};
  const qr = isRecord(instance.qr) ? instance.qr : {};
  const candidates = [qr.reason, instance.qrReason, metadata.qrReason];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toUpperCase();
    }
  }
  return null;
};

export interface GetNumberStatusOptions {
  /** O QR exibido para este número expirou sem leitura. */
  qrExpired?: boolean;
}

const getNumberStatusByKey = (key: NumberStatusKey): NumberStatus => ({
  key,
  ...STATUS_TABLE[key],
});

/**
 * Converte qualquer registro de número (ou status cru) em um status legível.
 * Status desconhecidos viram "Desconectado" — nunca aparecem crus na tela.
 */
export const getNumberStatus = (instance: unknown, options: GetNumberStatusOptions = {}): NumberStatus => {
  const record = isRecord(instance) ? instance : null;
  const normalized = normalizeWhatsAppStatus({
    status: readRawStatus(instance),
    connected: typeof record?.connected === 'boolean' ? (record.connected as boolean) : undefined,
  });

  let key: NumberStatusKey = normalized.connected
    ? 'connected'
    : NORMALIZED_TO_KEY[normalized.status] ?? 'disconnected';

  if (key === 'pairing' && (options.qrExpired || readQrReason(instance) === 'EXPIRED')) {
    key = 'qr_expired';
  }

  return getNumberStatusByKey(key);
};

export const NUMBER_STATUS_KEYS = Object.keys(STATUS_TABLE) as NumberStatusKey[];

export default getNumberStatus;
