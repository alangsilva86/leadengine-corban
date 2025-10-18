export const DEFAULT_TENANT_ID = (() => {
  const envValue = process.env.AUTH_MVP_TENANT_ID;
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue.trim();
  }
  return 'demo-tenant';
})();
