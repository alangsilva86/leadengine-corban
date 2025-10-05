// ============================================================================
// Integrations Package - Main Export
// ============================================================================

// WhatsApp Integration
export { BaileysWhatsAppProvider } from './whatsapp/baileys-provider';
export { WhatsAppInstanceManager } from './whatsapp/instance-manager';
export type {
  WhatsAppConfig,
  ConnectionStatus,
  WhatsAppMessage,
} from './whatsapp/baileys-provider';
export type {
  WhatsAppInstance,
  CreateInstanceRequest,
} from './whatsapp/instance-manager';

// Utilities
export { logger } from './utils/logger';

// Version
export const INTEGRATIONS_VERSION = '1.0.0';
