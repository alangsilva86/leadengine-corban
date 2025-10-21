import { useCallback } from 'react';
import { toast } from 'sonner';

const sanitizeDigits = (value) => {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
};

export const PHONE_ACTIONS = {
  CALL: 'call',
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  COPY: 'copy',
};

const openWindow = (url, target = '_self') => {
  if (typeof window === 'undefined') return false;
  window.open(url, target, target === '_blank' ? 'noopener' : undefined);
  return true;
};

export function usePhoneActions(rawPhone, options = {}) {
  const {
    onCall,
    missingPhoneMessage = 'Nenhum telefone disponível para este contato.',
    copySuccessMessage = 'Telefone copiado.',
  } = options;

  return useCallback(
    (action, overridePhone) => {
      const phone = overridePhone ?? rawPhone;
      const digits = sanitizeDigits(phone);

      if (!phone || !digits) {
        toast.info(missingPhoneMessage);
        return false;
      }

      const hasClipboard = typeof navigator !== 'undefined' && navigator.clipboard;

      switch (action) {
        case PHONE_ACTIONS.CALL:
        case 'call': {
          const opened = openWindow(`tel:${digits}`);
          if (!opened) {
            toast.info(`Ligue para ${phone}.`);
          }
          onCall?.(phone);
          return true;
        }
        case PHONE_ACTIONS.WHATSAPP:
        case 'whatsapp': {
          const opened = openWindow(`https://wa.me/${digits}`, '_blank');
          if (!opened) {
            toast.info(`Abra o WhatsApp e contate ${phone}.`);
          }
          return true;
        }
        case PHONE_ACTIONS.SMS:
        case 'sms': {
          const opened = openWindow(`sms:${digits}`);
          if (!opened) {
            toast.info(`Envie um SMS manualmente para ${phone}.`);
          }
          return true;
        }
        case PHONE_ACTIONS.COPY:
        case 'copy': {
          if (hasClipboard) {
            navigator.clipboard
              .writeText(String(phone))
              .then(() => toast.success(copySuccessMessage))
              .catch(() => toast.error('Não foi possível concluir. Tente novamente.'));
          } else {
            toast.info(`Copie manualmente: ${phone}`);
          }
          return true;
        }
        default:
          return false;
      }
    },
    [copySuccessMessage, missingPhoneMessage, onCall, rawPhone]
  );
}

export default usePhoneActions;
