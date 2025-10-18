export const mapErrorForLog = (error: unknown) =>
  error instanceof Error ? { message: error.message, stack: error.stack } : error;
