import { normalizeWhatsAppStatus } from '@leadengine/wa-status';

export const CONNECTION_STATUS_MAP = {
  success: 'connected',
  info: 'reconnecting',
  warning: 'attention',
  destructive: 'attention',
  secondary: 'disconnected',
  default: 'disconnected',
};

export const resolveConnectionState = (statusInfo) => {
  const normalized = normalizeWhatsAppStatus({
    status: statusInfo?.status,
    connected: typeof statusInfo?.connected === 'boolean' ? statusInfo.connected : undefined,
  });

  if (statusInfo?.variant && CONNECTION_STATUS_MAP[statusInfo.variant]) {
    return CONNECTION_STATUS_MAP[statusInfo.variant];
  }

  if (normalized.connected) {
    return CONNECTION_STATUS_MAP.success;
  }

  if (
    normalized.status === 'connecting' ||
    normalized.status === 'reconnecting' ||
    normalized.status === 'qr_required'
  ) {
    return CONNECTION_STATUS_MAP.info;
  }

  if (normalized.status === 'failed' || normalized.status === 'error') {
    return CONNECTION_STATUS_MAP.destructive;
  }

  return CONNECTION_STATUS_MAP.default;
};
