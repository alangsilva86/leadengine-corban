import { useCallback } from 'react';
import { toast } from 'sonner';

const normalizeValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

export const useClipboard = () => {
  const copy = useCallback(
    async (
      rawValue,
      {
        emptyMessage = 'Nenhum dado disponível para copiar.',
        successMessage = 'Copiado para a área de transferência.',
        errorMessage = 'Não foi possível copiar. Tente novamente.',
        fallbackMessage,
        onFallback,
      } = {},
    ) => {
      const value = normalizeValue(rawValue);
      if (!value || value === '—') {
        if (emptyMessage) {
          toast.info(emptyMessage);
        }
        return false;
      }

      if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(value);
          if (successMessage) {
            toast.success(successMessage);
          }
          return true;
        } catch (error) {
          if (errorMessage) {
            toast.error(errorMessage);
          }
          return false;
        }
      }

      if (typeof onFallback === 'function') {
        onFallback(value);
      } else if (fallbackMessage) {
        toast.info(typeof fallbackMessage === 'function' ? fallbackMessage(value) : fallbackMessage);
      }

      return false;
    },
  );

  return { copy };
};

export default useClipboard;
