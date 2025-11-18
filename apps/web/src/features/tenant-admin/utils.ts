export const readTenantAdminError = (error: unknown, fallback = 'Não foi possível concluir a operação.') => {
  if (error instanceof Error) {
    return error.message || fallback;
  }
  if (typeof error === 'object' && error && 'message' in error && typeof (error as any).message === 'string') {
    return (error as any).message as string;
  }
  const payloadMessage = typeof error === 'object' && error && 'payload' in error ? (error as any).payload?.error?.message : null;
  if (typeof payloadMessage === 'string' && payloadMessage.trim()) {
    return payloadMessage.trim();
  }
  return fallback;
};
