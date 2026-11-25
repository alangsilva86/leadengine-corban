import { useEffect, useState } from 'react';

/**
 * Devolve `value` somente depois que ele parar de mudar por `delay` ms.
 * Usado na busca da lista para não refazer a consulta a cada tecla.
 */
export const useDebouncedValue = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (Object.is(value, debounced)) {
      return undefined;
    }
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [debounced, delay, value]);

  return debounced;
};

export default useDebouncedValue;
