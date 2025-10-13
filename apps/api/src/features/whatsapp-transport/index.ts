import type { WhatsAppTransport } from './types';
import { HttpWhatsAppTransport } from './http-transport';

let cachedTransport: HttpWhatsAppTransport | null = null;

const createTransport = (): HttpWhatsAppTransport => {
  return new HttpWhatsAppTransport();
};

export const getWhatsAppTransport = (): WhatsAppTransport => {
  if (!cachedTransport) {
    cachedTransport = createTransport();
  }

  return cachedTransport;
};

export const refreshWhatsAppTransport = () => {
  cachedTransport = null;
};

export type { WhatsAppTransport } from './types';
export type { WhatsAppTransportSendMessagePayload } from './types';
