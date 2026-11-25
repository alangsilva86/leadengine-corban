import { useSyncExternalStore } from 'react';

const subscribe = (callback) => {
  if (typeof window === 'undefined') {
    return () => {};
  }
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

const getSnapshot = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);
const getServerSnapshot = () => true;

/** `false` quando o navegador informa que está sem internet. */
export const useOnlineStatus = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export default useOnlineStatus;
