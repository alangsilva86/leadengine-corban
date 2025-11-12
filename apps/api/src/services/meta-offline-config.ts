import { Prisma } from '@prisma/client';
import {
  getIntegrationState,
  upsertIntegrationState,
  deleteIntegrationState,
} from '@ticketz/storage';

const STATE_PREFIX = 'meta.offline.';

export interface MetaOfflineConfig {
  offlineEventSetId: string | null;
  pixelId: string | null;
  businessId: string | null;
  accessToken: string | null;
  appId: string | null;
  appSecret: string | null;
  actionSource: string | null;
  eventName: string | null;
  reprocessUnmatched: boolean;
  reprocessUnsent: boolean;
  reprocessWindowDays: number | null;
  connected: boolean;
  lastValidatedAt: string | null;
  lastValidationError: string | null;
}

export interface MetaOfflinePublicConfig {
  offlineEventSetId: string | null;
  pixelId: string | null;
  businessId: string | null;
  appId: string | null;
  actionSource: string | null;
  eventName: string | null;
  reprocessUnmatched: boolean;
  reprocessUnsent: boolean;
  reprocessWindowDays: number | null;
  connected: boolean;
  lastValidatedAt: string | null;
  lastValidationError: string | null;
  accessTokenConfigured: boolean;
  appSecretConfigured: boolean;
}

export interface MetaOfflineConfigUpdate {
  offlineEventSetId?: string | null;
  pixelId?: string | null;
  businessId?: string | null;
  accessToken?: string | null;
  appId?: string | null;
  appSecret?: string | null;
  actionSource?: string | null;
  eventName?: string | null;
  reprocessUnmatched?: boolean;
  reprocessUnsent?: boolean;
  reprocessWindowDays?: number | null;
  connected?: boolean;
  lastValidatedAt?: string | null;
  lastValidationError?: string | null;
}

const DEFAULT_CONFIG: MetaOfflineConfig = {
  offlineEventSetId: null,
  pixelId: null,
  businessId: null,
  accessToken: null,
  appId: null,
  appSecret: null,
  actionSource: null,
  eventName: null,
  reprocessUnmatched: false,
  reprocessUnsent: false,
  reprocessWindowDays: null,
  connected: false,
  lastValidatedAt: null,
  lastValidationError: null,
};

const toRecord = (value: Prisma.JsonValue | null): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return fallback;
};

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeStringInput = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeNumberInput = (value: number | string | null | undefined): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeBooleanInput = (value: boolean | null | undefined): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return Boolean(value);
};

const buildKey = (tenantId: string): string => `${STATE_PREFIX}${tenantId}`;

const computeConnected = (config: MetaOfflineConfig): boolean => {
  const hasCredentials = Boolean(config.accessToken && config.appSecret && config.offlineEventSetId);
  if (!hasCredentials) {
    return false;
  }
  return Boolean(config.connected);
};

const mergeConfig = (
  current: MetaOfflineConfig,
  updates: MetaOfflineConfigUpdate
): MetaOfflineConfig => {
  const next: MetaOfflineConfig = { ...current };

  const offlineEventSetId = normalizeStringInput(updates.offlineEventSetId);
  if (offlineEventSetId !== undefined) {
    next.offlineEventSetId = offlineEventSetId;
  }

  const pixelId = normalizeStringInput(updates.pixelId);
  if (pixelId !== undefined) {
    next.pixelId = pixelId;
  }

  const businessId = normalizeStringInput(updates.businessId);
  if (businessId !== undefined) {
    next.businessId = businessId;
  }

  const accessToken = normalizeStringInput(updates.accessToken);
  if (accessToken !== undefined) {
    next.accessToken = accessToken;
  }

  const appId = normalizeStringInput(updates.appId);
  if (appId !== undefined) {
    next.appId = appId;
  }

  const appSecret = normalizeStringInput(updates.appSecret);
  if (appSecret !== undefined) {
    next.appSecret = appSecret;
  }

  const actionSource = normalizeStringInput(updates.actionSource);
  if (actionSource !== undefined) {
    next.actionSource = actionSource;
  }

  const eventName = normalizeStringInput(updates.eventName);
  if (eventName !== undefined) {
    next.eventName = eventName;
  }

  const reprocessUnmatched = normalizeBooleanInput(updates.reprocessUnmatched);
  if (reprocessUnmatched !== undefined) {
    next.reprocessUnmatched = reprocessUnmatched;
  }

  const reprocessUnsent = normalizeBooleanInput(updates.reprocessUnsent);
  if (reprocessUnsent !== undefined) {
    next.reprocessUnsent = reprocessUnsent;
  }

  const reprocessWindowDays = normalizeNumberInput(updates.reprocessWindowDays);
  if (reprocessWindowDays !== undefined) {
    next.reprocessWindowDays = reprocessWindowDays;
  }

  if (updates.lastValidatedAt !== undefined) {
    next.lastValidatedAt = updates.lastValidatedAt;
  }

  if (updates.lastValidationError !== undefined) {
    next.lastValidationError = updates.lastValidationError;
  }

  if (updates.connected !== undefined) {
    next.connected = Boolean(updates.connected);
  }

  if (!next.accessToken || !next.appSecret || !next.offlineEventSetId) {
    next.connected = false;
  }

  return next;
};

const serializeForStorage = (config: MetaOfflineConfig): Prisma.JsonObject => {
  return {
    offlineEventSetId: config.offlineEventSetId,
    pixelId: config.pixelId,
    businessId: config.businessId,
    accessToken: config.accessToken,
    appId: config.appId,
    appSecret: config.appSecret,
    actionSource: config.actionSource,
    eventName: config.eventName,
    reprocessUnmatched: config.reprocessUnmatched,
    reprocessUnsent: config.reprocessUnsent,
    reprocessWindowDays: config.reprocessWindowDays,
    connected: config.connected,
    lastValidatedAt: config.lastValidatedAt,
    lastValidationError: config.lastValidationError,
  } satisfies Prisma.JsonObject;
};

export const loadMetaOfflineConfig = async (tenantId: string): Promise<MetaOfflineConfig> => {
  const raw = await getIntegrationState(buildKey(tenantId));
  const record = toRecord(raw);

  const merged: MetaOfflineConfig = {
    ...DEFAULT_CONFIG,
    offlineEventSetId: readString(record.offlineEventSetId) ?? DEFAULT_CONFIG.offlineEventSetId,
    pixelId: readString(record.pixelId) ?? DEFAULT_CONFIG.pixelId,
    businessId: readString(record.businessId) ?? DEFAULT_CONFIG.businessId,
    accessToken: readString(record.accessToken) ?? DEFAULT_CONFIG.accessToken,
    appId: readString(record.appId) ?? DEFAULT_CONFIG.appId,
    appSecret: readString(record.appSecret) ?? DEFAULT_CONFIG.appSecret,
    actionSource: readString(record.actionSource) ?? DEFAULT_CONFIG.actionSource,
    eventName: readString(record.eventName) ?? DEFAULT_CONFIG.eventName,
    reprocessUnmatched: readBoolean(record.reprocessUnmatched, DEFAULT_CONFIG.reprocessUnmatched),
    reprocessUnsent: readBoolean(record.reprocessUnsent, DEFAULT_CONFIG.reprocessUnsent),
    reprocessWindowDays: readNumber(record.reprocessWindowDays) ?? DEFAULT_CONFIG.reprocessWindowDays,
    connected: readBoolean(record.connected, DEFAULT_CONFIG.connected),
    lastValidatedAt: readString(record.lastValidatedAt) ?? DEFAULT_CONFIG.lastValidatedAt,
    lastValidationError: readString(record.lastValidationError) ?? DEFAULT_CONFIG.lastValidationError,
  };

  merged.connected = computeConnected(merged);

  return merged;
};

export const upsertMetaOfflineConfig = async (
  tenantId: string,
  updates: MetaOfflineConfigUpdate
): Promise<MetaOfflineConfig> => {
  const current = await loadMetaOfflineConfig(tenantId);
  const merged = mergeConfig(current, updates);
  await upsertIntegrationState(buildKey(tenantId), serializeForStorage(merged));
  return merged;
};

export const resetMetaOfflineConfig = async (tenantId: string): Promise<void> => {
  await deleteIntegrationState(buildKey(tenantId));
};

export const toPublicMetaOfflineConfig = (
  config: MetaOfflineConfig
): MetaOfflinePublicConfig => ({
  offlineEventSetId: config.offlineEventSetId,
  pixelId: config.pixelId,
  businessId: config.businessId,
  appId: config.appId,
  actionSource: config.actionSource,
  eventName: config.eventName,
  reprocessUnmatched: config.reprocessUnmatched,
  reprocessUnsent: config.reprocessUnsent,
  reprocessWindowDays: config.reprocessWindowDays,
  connected: computeConnected(config),
  lastValidatedAt: config.lastValidatedAt,
  lastValidationError: config.lastValidationError,
  accessTokenConfigured: Boolean(config.accessToken),
  appSecretConfigured: Boolean(config.appSecret),
});

export const markMetaOfflineValidationResult = async (
  tenantId: string,
  result: { success: boolean; message?: string | null; validatedAt?: Date }
): Promise<MetaOfflineConfig> => {
  const validatedAt = (result.validatedAt ?? new Date()).toISOString();
  const updates: MetaOfflineConfigUpdate = {
    connected: result.success,
    lastValidatedAt: validatedAt,
    lastValidationError: result.success ? null : result.message ?? 'Falha desconhecida',
  };
  return upsertMetaOfflineConfig(tenantId, updates);
};

export const __testing = {
  buildKey,
  toRecord,
  readString,
  readBoolean,
  readNumber,
  mergeConfig,
  serializeForStorage,
  normalizeStringInput,
};
