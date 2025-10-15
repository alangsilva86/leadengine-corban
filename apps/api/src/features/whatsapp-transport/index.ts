import type { WhatsAppTransport } from './types';
import { HttpWhatsAppTransport } from './http-transport';

let cachedTransport: WhatsAppTransport | null = null;

const createTransport = (): WhatsAppTransport => {
  return new HttpWhatsAppTransport();
};

export const getWhatsAppTransport = (): WhatsAppTransport => {
  if (!cachedTransport) {
    cachedTransport = createTransport();
  }
  return cachedTransport;
};

export type { WhatsAppTransport } from './types';
export type { WhatsAppTransportSendMessagePayload } from './types';
