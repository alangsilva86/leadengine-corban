import { Buffer } from 'node:buffer';
import { normalizeQrPayload, type NormalizedQrPayload } from '@ticketz/wa-contracts';
import type { WhatsAppStatus } from '../../../services/whatsapp-broker-client';
import type { NormalizedInstance } from './types';

export type NormalizedQr = NormalizedQrPayload;

export const normalizeQr = (value: unknown): NormalizedQr => normalizeQrPayload(value);

export const extractQrImageBuffer = (qr: NormalizedQr): Buffer | null => {
  const candidate = (qr.qrCode || qr.qr || '').trim();
  if (!candidate) {
    return null;
  }

  const dataUrlMatch = candidate.match(/^data:image\/(?:png|jpeg);base64,(?<data>[a-z0-9+/=_-]+)$/i);
  const base64Candidate = dataUrlMatch?.groups?.data ?? candidate;
  const sanitized = base64Candidate.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = sanitized.length % 4 === 0 ? '' : '='.repeat(4 - (sanitized.length % 4));
  const normalized = sanitized + padding;

  try {
    const buffer = Buffer.from(normalized, 'base64');
    return buffer.length > 0 ? buffer : null;
  } catch (_error) {
    return null;
  }
};

export const normalizeInstanceStatusResponse = (
  status: WhatsAppStatus | null | undefined
): {
  status: NormalizedInstance['status'];
  connected: boolean;
  qr: string | null;
  qrCode: string | null;
  expiresAt: string | null;
  qrExpiresAt: string | null;
  qrAvailable: boolean;
  qrReason: NormalizedQr['reason'];
} => {
  if (!status) {
    return {
      status: 'disconnected',
      connected: false,
      qr: null,
      qrCode: null,
      expiresAt: null,
      qrExpiresAt: null,
      qrAvailable: false,
      qrReason: 'UNAVAILABLE',
    };
  }

  return {
    status: status.status,
    connected: status.connected,
    qr: status.qr,
    qrCode: status.qrCode,
    expiresAt: status.expiresAt,
    qrExpiresAt: status.qrExpiresAt,
    qrAvailable: Boolean((status.qr ?? status.qrCode)?.trim?.()),
    qrReason: null,
  };
};
