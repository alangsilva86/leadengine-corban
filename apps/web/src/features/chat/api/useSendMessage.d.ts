import type { UseMutationResult } from '@tanstack/react-query';

export type ChatTemplateMetadata = {
  id: string;
  label: string;
  body?: string;
};

export type ChatAttachmentMetadata = {
  id?: string;
  name?: string;
  size?: number;
  type?: string;
  mimeType?: string;
  fileName?: string;
  mediaUrl?: string;
};

export type ChatMessageMetadata = {
  template?: ChatTemplateMetadata;
  attachments?: ChatAttachmentMetadata[];
};

export interface SendMessageMutationVariables {
  ticketId?: string | null;
  content: string;
  type?: string;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  caption?: string | null;
  quotedMessageId?: string | null;
  metadata?: ChatMessageMetadata;
}

export type SendMessageMutationResult = any;

declare function useSendMessage(args?: {
  fallbackTicketId?: string | null;
}): UseMutationResult<SendMessageMutationResult, unknown, SendMessageMutationVariables, unknown>;

export default useSendMessage;
