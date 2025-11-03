import { logger } from './logger';

export type AiRouteMode = 'front' | 'server';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'y']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'n']);

const parseBoolean = (value: string | undefined | null, fallback: boolean): boolean => {
  if (value == null) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return fallback;
};

export const getAiRouteMode = (): AiRouteMode => {
  const raw = (process.env.AI_ROUTE_MODE ?? '').trim().toLowerCase();
  return raw === 'front' ? 'front' : 'server';
};

const resolveServerAutoReplyEnabled = (): boolean => {
  const fallback = true;
  const raw =
    process.env.AI_AUTO_REPLY_SERVER_ENABLED ??
    process.env.AI_AUTO_REPLY_FORCE_SERVER ??
    process.env.AI_ROUTE_ALLOW_SERVER_AUTO_REPLY;

  return parseBoolean(raw, fallback);
};

export const getAiRoutingPreferences = () => {
  const mode = getAiRouteMode();
  const serverAutoReplyEnabled = resolveServerAutoReplyEnabled();
  const skipServerAutoReply = !serverAutoReplyEnabled && mode === 'front';

  return {
    mode,
    serverAutoReplyEnabled,
    skipServerAutoReply,
  };
};

export const logAiRouteConfiguration = () => {
  try {
    const { mode, serverAutoReplyEnabled, skipServerAutoReply } = getAiRoutingPreferences();
    logger.info('AI routing configuration resolved', {
      aiRouteMode: mode,
      serverAutoReplyEnabled,
      skipServerAutoReply,
    });
  } catch (error) {
    logger.warn('Failed to log AI routing configuration', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
