// ============================================================================
// Integrations Package - Main Export
// ============================================================================

// WhatsApp Integration
export { BaileysWhatsAppProvider } from './whatsapp/baileys-provider';
export { loadBaileysModule } from './whatsapp/baileys-loader';
export type {
  WhatsAppConfig,
  ConnectionStatus,
  WhatsAppMessage,
} from './whatsapp/baileys-provider';
export type {
  WhatsAppSessionStore,
  WhatsAppSessionData,
  WhatsAppSessionKeyMap,
} from './whatsapp/session-store';

// Utilities
export { logger } from './utils/logger';

// Version
export const INTEGRATIONS_VERSION = '1.0.0';
