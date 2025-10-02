const sessionStorageAvailable = () => {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return false;
  }

  try {
    const testKey = '__leadengine_session_storage_test__';
    window.sessionStorage.setItem(testKey, '1');
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch (error) {
    console.warn('Session storage indisponível', error);
    return false;
  }
};

export default sessionStorageAvailable;
