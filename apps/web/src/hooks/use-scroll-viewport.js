import { useCallback, useRef, useState } from 'react';

const useScrollViewport = () => {
  const viewportRef = useRef(null);
  const [scrollParent, setScrollParent] = useState(null);

  const registerViewport = useCallback((node) => {
    const nextNode = node ?? null;
    if (viewportRef.current !== nextNode) {
      viewportRef.current = nextNode;
    }
    setScrollParent((current) => (current === nextNode ? current : nextNode));
  }, []);

  return {
    registerViewport,
    viewportRef,
    scrollParent,
  };
};

export default useScrollViewport;
