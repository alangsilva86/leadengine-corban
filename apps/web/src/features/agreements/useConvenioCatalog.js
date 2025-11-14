import { useMemo } from 'react';
import { buildConvenioCatalog } from './data/convenioCatalog.js';

const useConvenioCatalog = () => {
  const convenios = useMemo(() => buildConvenioCatalog(), []);

  return {
    convenios,
    isLoading: false,
    error: null,
  };
};

export default useConvenioCatalog;
