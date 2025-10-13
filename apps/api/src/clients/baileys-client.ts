import { fetch } from 'undici';

import { logger } from '../config/logger';
import { getBrokerApiKey, getBrokerBaseUrl, isStrictBrokerConfigEnabled } from '../config/whatsapp';

export class BaileysClient {
  constructor(private readonly base: string, private readonly key: string) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const target = `${this.base.replace(/\/$/, '')}${path}`;
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.key}`,
      },
      body: JSON.stringify(body ?? {}),
    });

    const rawText = await response.text();
    if (!response.ok) {
      const snippet = rawText ? rawText.slice(0, 500) : '';
      throw new Error(`Baileys ${response.status} ${response.statusText}: ${snippet}`);
    }

    if (!rawText) {
      return {} as T;
    }

    try {
      return JSON.parse(rawText) as T;
    } catch (error) {
      logger.warn('Failed to parse Baileys response as JSON; returning raw text', {
        error,
        rawText: rawText.slice(0, 500),
      });
      return rawText as unknown as T;
    }
  }

  sendText(instanceId: string, to: string, text: string) {
    return this.post(`/instances/${instanceId}/messages/text`, { to, text });
  }

  sendMedia(
    instanceId: string,
    to: string,
    media: {
      mediaType: 'image' | 'video' | 'audio' | 'document';
      mimetype?: string;
      base64?: string;
      mediaUrl?: string;
      fileName?: string;
      caption?: string;
    }
  ) {
    return this.post(`/instances/${instanceId}/messages/media`, { to, ...media });
  }
}

export const makeBaileysClient = (): BaileysClient | null => {
  const url = getBrokerBaseUrl();
  const key = getBrokerApiKey();

  if (!url || !key) {
    if (isStrictBrokerConfigEnabled()) {
      throw new Error('WhatsApp broker configuration missing URL or API key');
    }
    return null;
  }

  return new BaileysClient(url, key);
};
