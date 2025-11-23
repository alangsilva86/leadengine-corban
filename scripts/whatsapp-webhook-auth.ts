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
  includeTenantHeader?: boolean;
  tenantId?: string | null | undefined;
  bearerToken?: string | null | undefined;
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

  const normalizedTenantId =
    typeof options.tenantId === 'string' && options.tenantId.trim().length > 0
      ? options.tenantId.trim()
      : null;

  const normalizedBearerToken =
    typeof options.bearerToken === 'string' && options.bearerToken.trim().length > 0
      ? options.bearerToken.trim()
      : normalizedApiKey;

  if (normalizedTenantId && options.includeTenantHeader !== false) {
    headers['x-tenant-id'] = normalizedTenantId;
  }

  if (normalizedApiKey) {
    if (options.includeApiKeyHeader !== false) {
      headers['x-api-key'] = normalizedApiKey;
    }
  }

  if (normalizedBearerToken && options.includeAuthorizationHeader !== false) {
    headers['Authorization'] = `Bearer ${normalizedBearerToken}`;
  }

  const signatureRequired = options.enforceSignature ?? isWebhookSignatureRequired();
  if (signatureRequired) {
    const secret = options.signatureSecret ?? getWebhookSignatureSecret() ?? normalizedApiKey;

    if (!secret) {
      throw new Error('Webhook signature enforcement is enabled but no secret is configured');
    }

    const digest = createHmac('sha256', secret).update(toBuffer(rawBody)).digest('hex');
    headers['x-webhook-signature-sha256'] = digest;
    headers['x-webhook-signature'] = digest;
    headers['x-signature-sha256'] = digest;
    headers['x-signature'] = digest;
  }

  return headers;
};
