export type AgreementsLogCategory =
  | 'basic'
  | 'lifecycle'
  | 'provider'
  | 'window'
  | 'rate';

export type AgreementsLogPhase = 'pre' | 'post' | 'error';

export type AgreementsLogContext = Record<string, unknown>;

type AgreementsLogLevel = 'info' | 'error';

const createLogPayload = (
  category: AgreementsLogCategory,
  phase: AgreementsLogPhase,
  context: AgreementsLogContext | undefined
) => ({
  category,
  phase,
  timestamp: new Date().toISOString(),
  ...context,
});

const emitLog = (
  level: AgreementsLogLevel,
  category: AgreementsLogCategory,
  phase: AgreementsLogPhase,
  message: string,
  context?: AgreementsLogContext
) => {
  const payload = createLogPayload(category, phase, context);
  const intro = `🎭 [agreements:${category}] (${phase})`;

  if (level === 'error') {
    console.error(`${intro} ${message}`, payload);
    return;
  }

  console.info(`${intro} ${message}`, payload);
};

const agreementsLogger = {
  info: (
    category: AgreementsLogCategory,
    phase: AgreementsLogPhase,
    message: string,
    context?: AgreementsLogContext
  ) => emitLog('info', category, phase, message, context),
  error: (
    category: AgreementsLogCategory,
    phase: AgreementsLogPhase,
    message: string,
    context?: AgreementsLogContext
  ) => emitLog('error', category, phase, message, context),
};

export default agreementsLogger;
