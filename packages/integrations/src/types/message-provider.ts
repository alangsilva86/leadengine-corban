export interface MessageProvider {
  sendMessage(
    channel: string,
    to: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<{ externalId: string; status: string }>;

  sendMedia(
    channel: string,
    to: string,
    mediaUrl: string,
    caption?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ externalId: string; status: string }>;
}
