export const WHATSAPP_STATUS = {
  CONNECTED: "connected",
  CONNECTING: "connecting",
  RECONNECTING: "reconnecting",
  DISCONNECTED: "disconnected",
  QR_REQUIRED: "qr_required",
  PENDING: "pending",
  FAILED: "failed",
  ERROR: "error",
} as const;

export type WhatsAppStatusValue = (typeof WHATSAPP_STATUS)[keyof typeof WHATSAPP_STATUS];

const NORMALIZED_STATUS_MAP: Record<string, WhatsAppStatusValue> = {
  connected: WHATSAPP_STATUS.CONNECTED,
  connecting: WHATSAPP_STATUS.CONNECTING,
  reconnecting: WHATSAPP_STATUS.RECONNECTING,
  qr_required: WHATSAPP_STATUS.QR_REQUIRED,
  qrrequired: WHATSAPP_STATUS.QR_REQUIRED,
  qr: WHATSAPP_STATUS.QR_REQUIRED,
  disconnected: WHATSAPP_STATUS.DISCONNECTED,
  pending: WHATSAPP_STATUS.PENDING,
  failed: WHATSAPP_STATUS.FAILED,
  error: WHATSAPP_STATUS.ERROR,
};

const normalizeStatusValue = (status: string | null | undefined): WhatsAppStatusValue | null => {
  if (typeof status !== "string") {
    return null;
  }

  const normalized = status.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return NORMALIZED_STATUS_MAP[normalized] ?? null;
};

export type NormalizeWhatsAppStatusOptions = {
  status?: string | null;
  connected?: boolean | null;
};

export type NormalizedWhatsAppStatus = {
  status: WhatsAppStatusValue;
  connected: boolean;
};

export const normalizeWhatsAppStatus = (
  options: NormalizeWhatsAppStatusOptions,
): NormalizedWhatsAppStatus => {
  const normalizedStatus = normalizeStatusValue(options.status);
  const resolvedConnected = Boolean(
    options.connected ?? (normalizedStatus === WHATSAPP_STATUS.CONNECTED ? true : undefined),
  );

  if (!normalizedStatus) {
    return {
      status: resolvedConnected ? WHATSAPP_STATUS.CONNECTED : WHATSAPP_STATUS.DISCONNECTED,
      connected: resolvedConnected,
    };
  }

  if (normalizedStatus === WHATSAPP_STATUS.DISCONNECTED && resolvedConnected) {
    return { status: WHATSAPP_STATUS.CONNECTED, connected: true };
  }

  return {
    status: normalizedStatus,
    connected: resolvedConnected,
  };
};
