import type {
  ExistsResult,
  SendMediaInput,
  SendResult,
  SendTextInput,
  StatusResult,
} from '@ticketz/wa-contracts';
import {
  WhatsAppTransportError,
  CANONICAL_ERRORS,
} from '@ticketz/wa-contracts';
import { WhatsAppInstanceManager } from '@ticketz/integrations';

import { getSidecarSessionsPath, getWhatsAppMode, type WhatsAppTransportMode } from '../../../config/whatsapp';
import { HttpBrokerTransport } from './http-broker-transport';
import { SidecarTransport } from './sidecar-transport';
import { DryRunTransport } from './dryrun-transport';

export interface WhatsAppTransport {
  readonly mode: WhatsAppTransportMode;
  sendText(input: SendTextInput): Promise<SendResult>;
  sendMedia(input: SendMediaInput): Promise<SendResult>;
  checkRecipient(input: { sessionId: string; instanceId?: string; to: string }): Promise<ExistsResult>;
  getStatus(input: { sessionId: string; instanceId?: string }): Promise<StatusResult>;
}

export type WhatsAppTransportFactoryOptions = {
  httpTransport?: HttpBrokerTransport;
  sidecarTransport?: SidecarTransport;
  dryrunTransport?: DryRunTransport;
  instanceManager?: WhatsAppInstanceManager;
};

const createSidecarManager = (): WhatsAppInstanceManager => {
  const sessionsPath = getSidecarSessionsPath();
  return new WhatsAppInstanceManager(sessionsPath);
};

const buildHttpTransport = (options: WhatsAppTransportFactoryOptions): WhatsAppTransport => {
  return options.httpTransport ?? new HttpBrokerTransport();
};

const buildSidecarTransport = (options: WhatsAppTransportFactoryOptions): WhatsAppTransport => {
  const manager = options.instanceManager ?? createSidecarManager();
  return options.sidecarTransport ?? new SidecarTransport(manager);
};

const buildDryrunTransport = (options: WhatsAppTransportFactoryOptions): WhatsAppTransport => {
  return options.dryrunTransport ?? new DryRunTransport();
};

export const buildWhatsAppTransport = (
  mode: WhatsAppTransportMode,
  options: WhatsAppTransportFactoryOptions = {}
): WhatsAppTransport => {
  switch (mode) {
    case 'http':
      return buildHttpTransport(options);
    case 'sidecar':
      return buildSidecarTransport(options);
    case 'dryrun':
      return buildDryrunTransport(options);
    case 'disabled':
    default:
      throw new WhatsAppTransportError('Transporte WhatsApp desabilitado.', {
        code: CANONICAL_ERRORS.TRANSPORT_NOT_CONFIGURED.code,
        canonical: CANONICAL_ERRORS.TRANSPORT_NOT_CONFIGURED,
        transport: mode,
      });
  }
};

let cachedTransport: WhatsAppTransport | null = null;
let cachedMode: WhatsAppTransportMode | null = null;

export const resolveWhatsAppTransport = (
  options: WhatsAppTransportFactoryOptions = {}
): WhatsAppTransport => {
  const mode = getWhatsAppMode();

  if (cachedTransport && cachedMode === mode && Object.keys(options).length === 0) {
    return cachedTransport;
  }

  const transport = buildWhatsAppTransport(mode, options);

  if (Object.keys(options).length === 0) {
    cachedTransport = transport;
    cachedMode = mode;
  }

  return transport;
};

export const resetWhatsAppTransportCache = () => {
  cachedTransport = null;
  cachedMode = null;
};
