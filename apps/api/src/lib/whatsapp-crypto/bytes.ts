import { Buffer } from 'node:buffer';

import { WhatsAppCryptoError } from './errors';

/**
 * Binary values as they reach the API: raw bytes, JSON-serialized Buffers
 * (`{ type: 'Buffer', data: [...] }`), JSON-serialized typed arrays (`{ "0": 1, "1": 2 }`),
 * plain number arrays or base64/base64url strings (optionally with a `data:…;base64,` prefix).
 */
export type BinaryInput =
  | Uint8Array
  | ArrayBuffer
  | readonly number[]
  | { type: 'Buffer'; data: readonly number[] }
  | Record<string, number>
  | string;

const BASE64_PATTERN = /^[A-Za-z0-9+/_-]*={0,2}$/u;
const DATA_URI_PREFIX = /^data:[^,]*;base64,/iu;

const isByteArray = (value: unknown): value is readonly number[] =>
  Array.isArray(value) &&
  value.every((entry) => typeof entry === 'number' && Number.isInteger(entry) && entry >= 0 && entry <= 255);

const decodeBase64 = (value: string): Buffer | null => {
  const compact = value.replace(DATA_URI_PREFIX, '').replace(/\s+/gu, '');
  if (!BASE64_PATTERN.test(compact)) {
    return null;
  }
  const unpadded = compact.replace(/=+$/u, '');
  // A single trailing base64 character cannot encode a full byte.
  if (unpadded.length % 4 === 1) {
    return null;
  }
  return Buffer.from(unpadded, 'base64');
};

const decodeIndexedObject = (value: Record<string, unknown>): Buffer | null => {
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return null;
  }
  const bytes = new Array<number>(keys.length);
  for (let index = 0; index < keys.length; index += 1) {
    const entry = value[String(index)];
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry > 255) {
      return null;
    }
    bytes[index] = entry;
  }
  return Buffer.from(bytes);
};

/**
 * Best-effort conversion of a binary-ish value to a Buffer. Returns `null` when the value
 * cannot be interpreted as bytes (never throws).
 */
export const tryToBuffer = (value: unknown): Buffer | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }
  if (typeof value === 'string') {
    return decodeBase64(value.trim());
  }
  if (isByteArray(value)) {
    return Buffer.from(value);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.type === 'Buffer' && isByteArray(record.data)) {
      return Buffer.from(record.data);
    }
    return decodeIndexedObject(record);
  }
  return null;
};

/**
 * Strict conversion used at the module boundary: throws `INVALID_INPUT` when the value is not
 * binary or does not have the expected length. The error message names the field, never its value.
 */
export const toBuffer = (
  value: unknown,
  field: string,
  constraints: { length?: number; minLength?: number } = {}
): Buffer => {
  const buffer = tryToBuffer(value);
  if (!buffer) {
    throw new WhatsAppCryptoError('INVALID_INPUT', `${field} is missing or is not valid binary data`, {
      details: { field },
    });
  }
  if (constraints.length !== undefined && buffer.length !== constraints.length) {
    throw new WhatsAppCryptoError(
      'INVALID_INPUT',
      `${field} must be ${constraints.length} bytes (got ${buffer.length})`,
      { details: { field, expected: constraints.length, actual: buffer.length } }
    );
  }
  if (constraints.minLength !== undefined && buffer.length < constraints.minLength) {
    throw new WhatsAppCryptoError(
      'INVALID_INPUT',
      `${field} must be at least ${constraints.minLength} bytes (got ${buffer.length})`,
      { details: { field, expected: constraints.minLength, actual: buffer.length } }
    );
  }
  return buffer;
};
