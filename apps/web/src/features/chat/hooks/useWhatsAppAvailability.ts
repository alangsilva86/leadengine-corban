import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { resolveWhatsAppErrorCopy } from '../../whatsapp/utils/whatsapp-error-codes.js';

interface WhatsAppErrorLike {
  payload?: { code?: string | null } | null;
  code?: string | null;
  message?: string | null;
}

interface UseWhatsAppAvailabilityInput {
  selectedTicketId?: string | null;
}

// Só oferecemos "Reconectar ao WhatsApp" quando a falha é de conexão do número/broker.
const CONNECTION_ERROR_CODES = new Set([
  'BROKER_ERROR',
  'BROKER_TIMEOUT',
  'BROKER_NOT_CONFIGURED',
  'INSTANCE_NOT_CONNECTED',
  'INSTANCE_DISCONNECTED',
  'WHATSAPP_NOT_CONFIGURED',
]);

const isConnectionError = (code: string | null | undefined) =>
  typeof code === 'string' && (CONNECTION_ERROR_CODES.has(code) || code.startsWith('BROKER_') || code.startsWith('INSTANCE_'));

export const useWhatsAppAvailability = ({ selectedTicketId }: UseWhatsAppAvailabilityInput) => {
  const [unavailability, setUnavailability] = useState<ReturnType<typeof resolveWhatsAppErrorCopy> | null>(null);
  const [notice, setNotice] = useState<(ReturnType<typeof resolveWhatsAppErrorCopy> & {
    requestId?: string | null;
    action?: string | null;
    actionLabel?: string | null;
    queuedMessageId?: string | null;
    timestamp?: string;
  }) | null>(null);

  useEffect(() => {
    setUnavailability(null);
    setNotice(null);
  }, [selectedTicketId]);

  const resetAvailability = useCallback(() => {
    setUnavailability(null);
    setNotice(null);
  }, []);

  const notifyOutboundError = useCallback(
    (error: WhatsAppErrorLike | null | undefined, fallbackMessage: string) => {
      const fallback = fallbackMessage || 'Não foi possível enviar a mensagem.';
      const rawCode =
        error?.payload?.code ?? (error as any)?.payload?.error?.code ?? (error as any)?.error?.code ?? error?.code ?? null;
      const copy = resolveWhatsAppErrorCopy(rawCode, error?.message ?? fallback);
      const title = copy.title ?? 'Mensagem não enviada';
      const recoveryHint =
        typeof error?.payload?.recoveryHint === 'string'
          ? error.payload.recoveryHint
          : typeof error?.payload?.error?.recoveryHint === 'string'
            ? error.payload.error.recoveryHint
            : null;
      const requestId =
        typeof error?.payload?.error?.requestId === 'string'
          ? error.payload.error.requestId
          : typeof error?.payload?.requestId === 'string'
            ? error.payload.requestId
            : error?.requestId ?? null;
      const description =
        recoveryHint ?? copy.description ?? fallback;
      const enrichedDescription = requestId ? `${description} (ID: ${requestId})` : description;

      toast.error(title, { description: enrichedDescription });

      const offerReconnect = isConnectionError(copy.code);
      const banner = {
        ...copy,
        title,
        description: enrichedDescription,
        requestId,
        action: offerReconnect ? ('refresh_instances' as const) : null,
        actionLabel: offerReconnect ? 'Reconectar ao WhatsApp' : null,
        queuedMessageId:
          typeof error?.payload?.error?.queuedMessageId === 'string'
            ? error.payload.error.queuedMessageId
            : null,
        timestamp: new Date().toISOString(),
      };

      setNotice(banner);
      setUnavailability(copy.code === 'BROKER_NOT_CONFIGURED' ? banner : null);

      return banner;
    },
    []
  );

  return {
    unavailableReason: unavailability,
    composerDisabled: Boolean(unavailability),
    notice,
    notifyOutboundError,
    resetAvailability,
  } as const;
};

export type UseWhatsAppAvailabilityReturn = ReturnType<typeof useWhatsAppAvailability>;

export default useWhatsAppAvailability;
