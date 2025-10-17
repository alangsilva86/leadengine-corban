import { useCallback } from 'react';
import { toast } from 'sonner';

export const useWhatsAppLauncher = () => {
  const openWhatsAppWindow = useCallback((rawPhone, initialMessage) => {
    const digits = String(rawPhone ?? '').replace(/\D/g, '');
    if (!digits) {
      toast.info('Nenhum telefone disponível para este lead.', {
        description: 'Cadastre um telefone válido para abrir o WhatsApp automaticamente.',
        position: 'bottom-right',
      });
      return false;
    }

    const messageParam =
      typeof initialMessage === 'string' && initialMessage.trim().length > 0
        ? `?text=${encodeURIComponent(initialMessage.trim())}`
        : '';

    if (typeof window !== 'undefined') {
      window.open(`https://wa.me/${digits}${messageParam}`, '_blank');
    }

    return true;
  }, []);

  const openWhatsAppForAllocation = useCallback(
    (allocation) => openWhatsAppWindow(allocation?.phone, allocation?.initialMessage),
    [openWhatsAppWindow]
  );

  return { openWhatsAppWindow, openWhatsAppForAllocation };
};

export default useWhatsAppLauncher;
