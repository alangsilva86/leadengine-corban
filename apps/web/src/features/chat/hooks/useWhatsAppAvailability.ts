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

export const useWhatsAppAvailability = ({ selectedTicketId }: UseWhatsAppAvailabilityInput) => {
  const [unavailability, setUnavailability] = useState<ReturnType<typeof resolveWhatsAppErrorCopy> | null>(null);

  useEffect(() => {
    setUnavailability(null);
  }, [selectedTicketId]);

  const resetAvailability = useCallback(() => {
    setUnavailability(null);
  }, []);

  const notifyOutboundError = useCallback(
    (error: WhatsAppErrorLike | null | undefined, fallbackMessage: string) => {
      const fallback = fallbackMessage || 'Não foi possível enviar a mensagem.';
      const copy = resolveWhatsAppErrorCopy(error?.payload?.code ?? error?.code, error?.message ?? fallback);
      const title = copy.title ?? 'Falha ao enviar mensagem';
      const description = copy.description ?? fallback;

      toast.error(title, { description });

      setUnavailability(copy.code === 'BROKER_NOT_CONFIGURED' ? copy : null);

      return copy;
    },
    []
  );

  return {
    unavailableReason: unavailability,
    composerDisabled: Boolean(unavailability),
    notifyOutboundError,
    resetAvailability,
  } as const;
};

export type UseWhatsAppAvailabilityReturn = ReturnType<typeof useWhatsAppAvailability>;

export default useWhatsAppAvailability;
