import type { WhatsAppTransportMode } from '../../config/whatsapp';
import type { WhatsAppMessageResult } from '../../services/whatsapp-broker-client';

export type WhatsAppTransportSendMessagePayload = {
  to: string;
  content?: string;
  caption?: string;
  type?: string;
  previewUrl?: boolean;
  externalId?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  media?: Record<string, unknown>;
  location?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  template?: Record<string, unknown>;
  poll?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export interface WhatsAppTransport {
  readonly mode: WhatsAppTransportMode;
  sendMessage(
    instanceId: string,
    payload: WhatsAppTransportSendMessagePayload,
    options?: { idempotencyKey?: string }
  ): Promise<WhatsAppMessageResult & { raw?: Record<string, unknown> | null }>;
  checkRecipient(payload: {
    sessionId: string;
    instanceId?: string;
    to: string;
  }): Promise<Record<string, unknown>>;
  getGroups(payload: { sessionId: string; instanceId?: string }): Promise<Record<string, unknown>>;
  createPoll(payload: {
    sessionId: string;
    instanceId?: string;
    to: string;
    question: string;
    options: string[];
    allowMultipleAnswers?: boolean;
  }): Promise<{
    id: string;
    status: string;
    ack: string | number | null;
    rate: unknown;
    raw: Record<string, unknown> | null;
  }>;
}
