import { useEffect, useState } from 'react';

export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof query !== 'string') {
      return false;
    }

    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof query !== 'string') {
      return undefined;
    }

    let mediaQueryList;
    try {
      mediaQueryList = window.matchMedia(query);
    } catch {
      setMatches(false);
      return undefined;
    }

    const updateMatch = (event) => {
      setMatches(event.matches);
    };

    setMatches(mediaQueryList.matches);

    mediaQueryList.addEventListener('change', updateMatch);
    return () => {
      mediaQueryList.removeEventListener('change', updateMatch);
    };
  }, [query]);

  return matches;
};

export default useMediaQuery;
