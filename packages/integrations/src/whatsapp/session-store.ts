import type { AuthenticationCreds, AuthenticationState } from '@whiskeysockets/baileys';

export type WhatsAppSessionKeyMap = Partial<Record<string, Record<string, unknown>>>;

export interface WhatsAppSessionData {
  creds: AuthenticationCreds;
  keys: WhatsAppSessionKeyMap;
  updatedAt: Date;
}

export interface WhatsAppSessionStore {
  load(instanceId: string): Promise<WhatsAppSessionData | null>;
  save(instanceId: string, data: WhatsAppSessionData): Promise<void>;
  delete(instanceId: string): Promise<void>;
}

export type WhatsAppSessionAuthState = {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clear: () => Promise<void>;
};
