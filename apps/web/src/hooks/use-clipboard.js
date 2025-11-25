import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

const normalizeValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

const showToast = (type, message, stateRef) => {
  if (!message) return;
  const now = Date.now();
  const previous = stateRef.current;
  if (previous && previous.message === message && now - previous.timestamp < 1200) {
    return;
  }
  stateRef.current = { message, timestamp: now };
  toast[type]?.(message);
};

const createHiddenTextarea = (value) => {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);

  let cleaned = false;
  const cleanup = () => {
    if (!cleaned && textarea?.parentNode === document.body) {
      document.body.removeChild(textarea);
    }
    cleaned = true;
  };

  return { textarea, cleanup };
};

const copyWithFallback = async (value) => {
  try {
    if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // swallow and attempt fallback
  }

  if (typeof document !== 'undefined') {
    const { textarea, cleanup } = createHiddenTextarea(value);
    textarea.select();
    try {
      const ok = document.execCommand('copy');
      return ok;
    } catch {
      return false;
    } finally {
      cleanup();
    }
  }

  return false;
};

export const useClipboard = () => {
  const toastStateRef = useRef(null);

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
          showToast('info', typeof emptyMessage === 'function' ? emptyMessage(value) : emptyMessage, toastStateRef);
        }
        return false;
      }

      const success = await copyWithFallback(value);

      if (success) {
        if (successMessage) {
          showToast(
            'success',
            typeof successMessage === 'function' ? successMessage(value) : successMessage,
            toastStateRef,
          );
        }
        return true;
      }

      if (errorMessage) {
        showToast('error', typeof errorMessage === 'function' ? errorMessage(value) : errorMessage, toastStateRef);
      }

      if (typeof onFallback === 'function') {
        onFallback(value);
      } else if (fallbackMessage) {
        showToast(
          'info',
          typeof fallbackMessage === 'function' ? fallbackMessage(value) : fallbackMessage,
          toastStateRef,
        );
      }

      return false;
    },
    [toastStateRef],
  );

  return { copy };
};

export default useClipboard;
