import { WhatsAppInstanceManager } from '@ticketz/integrations';

import { logger } from '../../../config/logger';
import { getSidecarSessionsPath, hasCustomSidecarSessionsPath } from '../../../config/whatsapp';
import { registerWhatsAppSidecarBridge } from '../sidecar-bridge';

interface StartOptions {
  manager?: WhatsAppInstanceManager;
  dedupeTtlMs?: number;
}

let activeManager: WhatsAppInstanceManager | null = null;
let bridgeCleanup: (() => void) | null = null;

const createManager = (): WhatsAppInstanceManager => {
  const sessionsPath = getSidecarSessionsPath();
  if (hasCustomSidecarSessionsPath()) {
    logger.info('Initializing WhatsApp sidecar instance manager with custom sessions path', {
      sessionsPath,
    });
    return new WhatsAppInstanceManager(sessionsPath);
  }

  logger.info('Initializing WhatsApp sidecar instance manager with default sessions path');
  return new WhatsAppInstanceManager(sessionsPath);
};

export const ensureWhatsAppSidecarManager = (): WhatsAppInstanceManager => {
  if (!activeManager) {
    activeManager = createManager();
  }

  return activeManager;
};

export const startWhatsAppSidecarBridge = (options: StartOptions = {}): void => {
  if (bridgeCleanup) {
    return;
  }

  const manager = options.manager ?? ensureWhatsAppSidecarManager();
  activeManager = manager;

  bridgeCleanup = registerWhatsAppSidecarBridge(manager, {
    dedupeTtlMs: options.dedupeTtlMs,
  });

  logger.info('WhatsApp sidecar bridge activated');
};

export const stopWhatsAppSidecarBridge = (): void => {
  if (!bridgeCleanup) {
    return;
  }

  bridgeCleanup();
  bridgeCleanup = null;

  logger.info('WhatsApp sidecar bridge deactivated');
};

const resetWhatsAppSidecarRuntime = (): void => {
  bridgeCleanup = null;
  activeManager = null;
};

export const __testing = {
  reset: resetWhatsAppSidecarRuntime,
  getActiveManager: () => activeManager,
  getBridgeCleanup: () => bridgeCleanup,
};
