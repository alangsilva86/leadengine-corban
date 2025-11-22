const readShowAllPreference = () => {
  try {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem('wa_show_all_instances') === '1';
  } catch {
    return false;
  }
};

const persistShowAllPreference = (value: boolean) => {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('wa_show_all_instances', value ? '1' : '0');
  } catch {
    // ignore storage issues
  }
};

export { persistShowAllPreference, readShowAllPreference };
