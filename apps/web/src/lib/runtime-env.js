const getImportMetaEnv = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta && typeof import.meta === 'object') {
      return import.meta.env ?? {};
    }
  } catch (error) {
    console.debug('Failed to access import.meta.env', error);
  }
  return {};
};

const getProcessEnv = () => {
  const candidate =
    typeof globalThis !== 'undefined' &&
    globalThis &&
    typeof globalThis === 'object' &&
    'process' in globalThis
      ? globalThis.process
      : undefined;

  if (candidate && typeof candidate === 'object') {
    return candidate.env ?? {};
  }

  return {};
};

export const getEnvVar = (key, fallback) => {
  if (!key || typeof key !== 'string') {
    return fallback;
  }

  const importMetaEnv = getImportMetaEnv();
  if (Object.prototype.hasOwnProperty.call(importMetaEnv, key)) {
    const value = importMetaEnv[key];
    return value ?? fallback;
  }

  const processEnv = getProcessEnv();
  if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
    const value = processEnv[key];
    return value ?? fallback;
  }

  return fallback;
};

export const getRuntimeEnv = () => ({
  ...getProcessEnv(),
  ...getImportMetaEnv(),
});
