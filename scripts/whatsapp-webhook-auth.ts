import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';

import {
  getWebhookApiKey,
  getWebhookSignatureSecret,
  isWebhookSignatureRequired,
} from '../apps/api/src/config/whatsapp';

export type BuildWebhookAuthHeadersOptions = {
  apiKey?: string | null | undefined;
  signatureSecret?: string | null | undefined;
  enforceSignature?: boolean;
  includeApiKeyHeader?: boolean;
  includeAuthorizationHeader?: boolean;
};

const toBuffer = (rawBody: string | Buffer | Uint8Array | null | undefined): Buffer => {
  if (rawBody === null || rawBody === undefined) {
    return Buffer.alloc(0);
  }

  if (typeof rawBody === 'string') {
    return Buffer.from(rawBody);
  }

  if (Buffer.isBuffer(rawBody)) {
    return rawBody;
  }

  if (rawBody instanceof Uint8Array) {
    return Buffer.from(rawBody);
  }

  throw new TypeError('Unsupported raw body type for webhook signature');
};

export const buildWebhookAuthHeaders = (
  rawBody: string | Buffer | Uint8Array | null | undefined,
  options: BuildWebhookAuthHeadersOptions = {}
): Record<string, string> => {
  const headers: Record<string, string> = {};

  const resolvedApiKey = options.apiKey ?? getWebhookApiKey();
  const normalizedApiKey =
    typeof resolvedApiKey === 'string' && resolvedApiKey.trim().length > 0
      ? resolvedApiKey.trim()
      : null;

  if (normalizedApiKey) {
    if (options.includeApiKeyHeader !== false) {
      headers['x-api-key'] = normalizedApiKey;
    }

    if (options.includeAuthorizationHeader !== false) {
      headers['Authorization'] = `Bearer ${normalizedApiKey}`;
    }
  }

  const signatureRequired = options.enforceSignature ?? isWebhookSignatureRequired();
  if (signatureRequired) {
    const secret = options.signatureSecret ?? getWebhookSignatureSecret() ?? normalizedApiKey;

    if (!secret) {
      throw new Error('Webhook signature enforcement is enabled but no secret is configured');
    }

    const digest = createHmac('sha256', secret).update(toBuffer(rawBody)).digest('hex');
    headers['x-webhook-signature-sha256'] = digest;
  }

  return headers;
};
