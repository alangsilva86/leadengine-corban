import { useEffect } from 'react';

export const APP_NAME = 'Lead Engine';

/** Define o título da aba como "<página> · Lead Engine" enquanto o componente estiver montado. */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (typeof document === 'undefined' || typeof title !== 'string' || !title.trim()) {
      return undefined;
    }
    const previous = document.title;
    document.title = `${title.trim()} · ${APP_NAME}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export default useDocumentTitle;
