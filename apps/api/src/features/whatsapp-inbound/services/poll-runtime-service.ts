import crypto from 'node:crypto';

import { getPollEncryptionConfig } from '../../../config/poll-encryption';
import { logger } from '../../../config/logger';
import {
  readPollMetadataStore,
  writePollMetadataStore,
} from '../../../data/poll-runtime-store';
import type { PollMetadataOption, PollMetadataPayload } from './poll-metadata-service';

type StoredPollVote = {
  voterJid: string;
  optionIds: string[];
  selectedOptions: Array<{ id: string; title: string | null }>;
  updatedAt: string;
};

type StoredPollMetadata = {
  pollId: string;
  question: string | null;
  selectableOptionsCount: number | null;
  allowMultipleAnswers: boolean | null;
  options: PollMetadataOption[];
  creationMessageId: string | null;
  creationMessageKey: PollMetadataPayload['creationMessageKey'] | null;
  messageSecretEnvelope: EncryptedSecret | null;
  messageSecretFingerprint: string | null;
  messageSecretVersion: number | null;
  tenantId: string | null;
  instanceId: string | null;
  rawMessage: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  hints: {
    receiptJids: string[];
    creatorJids: string[];
  };
  votes: StoredPollVote[];
};

type EncryptedSecret = {
  v: 1;
  iv: string;
  tag: string;
  ciphertext: string;
};

type RememberPollCreationInput = {
  pollId: string;
  question: string | null;
  selectableOptionsCount: number | null;
  allowMultipleAnswers: boolean | null;
  options: PollMetadataOption[];
  creationMessageId: string | null;
  creationMessageKey: PollMetadataPayload['creationMessageKey'] | null;
  messageSecret: string | null;
  messageSecretVersion: number | null;
  tenantId: string | null;
  instanceId: string | null;
  rawMessage: Record<string, unknown> | null;
  creatorJid?: string | null;
  expiresAt?: number | null;
};

type RegisterReceiptHintInput = {
  pollId: string;
  hintJid: string | null | undefined;
};

type RecordVoteSelectionInput = {
  pollId: string;
  voterJid: string;
  optionIds: string[];
  selectedOptions: Array<{ id: string; title: string | null }>;
};

type RuntimePollMetadata = Omit<StoredPollMetadata, 'votes' | 'hints'> & {
  hints: {
    receiptJids: Set<string>;
    creatorJids: Set<string>;
  };
  votes: Map<string, StoredPollVote>;
};

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const encryptSecret = (secret: string, key: Buffer): EncryptedSecret => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
};

const decryptSecret = (envelope: EncryptedSecret, key: Buffer): string | null => {
  try {
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    logger.warn('Failed to decrypt poll secret', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const fingerprintSecret = (secret: string | null): string | null => {
  if (!secret || secret.trim().length === 0) {
    return null;
  }

  return crypto.createHash('sha256').update(secret.trim()).digest('hex');
};

const cloneMetadata = (input: RuntimePollMetadata): RuntimePollMetadata => ({
  ...input,
  hints: {
    receiptJids: new Set(input.hints.receiptJids),
    creatorJids: new Set(input.hints.creatorJids),
  },
  votes: new Map(input.votes),
});

export class PollRuntimeService {
  private readonly ttlMs: number;
  private readonly encryptionKey: Buffer;
  private readonly encryptionKeySource: string;
  private readonly metadataByPollId = new Map<string, RuntimePollMetadata>();
  private readonly pollIdByCreationId = new Map<string, string>();
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private persistTimer: NodeJS.Timeout | null = null;
  private persistPending = false;

  constructor(options?: { ttlMs?: number }) {
    this.ttlMs = Number.isFinite(options?.ttlMs) && (options?.ttlMs ?? 0) > 0 ? (options?.ttlMs as number) : DEFAULT_TTL_MS;
    const pollEncryption = getPollEncryptionConfig();
    this.encryptionKey = pollEncryption.key;
    this.encryptionKeySource = pollEncryption.source;

    if (pollEncryption.usingFallbackSource) {
      logger.warn('Poll runtime encryption key não definida via POLL_METADATA_ENCRYPTION_KEY; usando fallback.', {
        source: this.encryptionKeySource,
      });
    } else {
      logger.info('Poll runtime encryption key configurada', { source: this.encryptionKeySource });
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistPending = true;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persist().catch((error) => {
        logger.warn('Poll runtime service failed to persist state', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, 2_000);
  }

  private async persist(): Promise<void> {
    if (!this.persistPending) {
      return;
    }
    this.persistPending = false;

    const payload: Record<string, StoredPollMetadata> = {};

    for (const entry of this.metadataByPollId.values()) {
      payload[entry.pollId] = {
        pollId: entry.pollId,
        question: entry.question,
        selectableOptionsCount: entry.selectableOptionsCount,
        allowMultipleAnswers: entry.allowMultipleAnswers,
        options: entry.options,
        creationMessageId: entry.creationMessageId,
        creationMessageKey: entry.creationMessageKey,
        messageSecretEnvelope: entry.messageSecretEnvelope,
        messageSecretFingerprint: entry.messageSecretFingerprint,
        messageSecretVersion: entry.messageSecretVersion,
        tenantId: entry.tenantId,
        instanceId: entry.instanceId,
        rawMessage: entry.rawMessage,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        expiresAt: entry.expiresAt,
        hints: {
          receiptJids: Array.from(entry.hints.receiptJids),
          creatorJids: Array.from(entry.hints.creatorJids),
        },
        votes: Array.from(entry.votes.values()),
      };
    }

    await writePollMetadataStore(payload);
  }

  private async load(): Promise<void> {
    const raw = await readPollMetadataStore();
    const now = Date.now();

    for (const [pollId, value] of Object.entries(raw)) {
      if (!pollId || typeof value !== 'object' || !value) {
        continue;
      }

      const record = value as StoredPollMetadata;
      if (record.expiresAt) {
        const expiresAt = Date.parse(record.expiresAt);
        if (Number.isFinite(expiresAt) && expiresAt < now) {
          continue;
        }
      }

      const hints = {
        receiptJids: new Set(record.hints?.receiptJids ?? []),
        creatorJids: new Set(record.hints?.creatorJids ?? []),
      };

      const votes = new Map<string, StoredPollVote>();
      for (const vote of record.votes ?? []) {
        if (!vote || !vote.voterJid) {
          continue;
        }
        votes.set(vote.voterJid, vote);
      }

      const runtimeRecord: RuntimePollMetadata = {
        pollId,
        question: record.question ?? null,
        selectableOptionsCount: record.selectableOptionsCount ?? null,
        allowMultipleAnswers: record.allowMultipleAnswers ?? null,
        options: Array.isArray(record.options) ? record.options : [],
        creationMessageId: record.creationMessageId ?? null,
        creationMessageKey: record.creationMessageKey ?? null,
        messageSecretEnvelope: record.messageSecretEnvelope ?? null,
        messageSecretFingerprint: record.messageSecretFingerprint ?? null,
        messageSecretVersion: record.messageSecretVersion ?? null,
        tenantId: record.tenantId ?? null,
        instanceId: record.instanceId ?? null,
        rawMessage: record.rawMessage ?? null,
        createdAt: record.createdAt ?? new Date().toISOString(),
        updatedAt: record.updatedAt ?? record.createdAt ?? new Date().toISOString(),
        expiresAt: record.expiresAt ?? null,
        hints,
        votes,
      };

      this.metadataByPollId.set(pollId, runtimeRecord);

      if (runtimeRecord.creationMessageId) {
        this.pollIdByCreationId.set(runtimeRecord.creationMessageId, pollId);
      }
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [pollId, record] of this.metadataByPollId.entries()) {
      if (!record.expiresAt) {
        continue;
      }

      const expiresAt = Date.parse(record.expiresAt);
      if (Number.isFinite(expiresAt) && expiresAt < now) {
        this.metadataByPollId.delete(pollId);
        if (record.creationMessageId) {
          this.pollIdByCreationId.delete(record.creationMessageId);
        }
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        await this.load();
        this.pruneExpired();
        this.initialized = true;
      })();
    }

    await this.initializationPromise;
  }

  async rememberPollCreation(input: RememberPollCreationInput): Promise<void> {
    await this.ensureInitialized();

    const pollId = input.pollId.trim();
    if (!pollId) {
      return;
    }

    const now = Date.now();
    const expiresAtMs = Number.isFinite(input.expiresAt)
      ? (input.expiresAt as number)
      : now + this.ttlMs;
    const expiresAt = new Date(expiresAtMs).toISOString();
    const createdAt = new Date(now).toISOString();

    let messageSecretEnvelope: EncryptedSecret | null = null;
    let messageSecretFingerprint: string | null = null;
    if (input.messageSecret && input.messageSecret.trim().length > 0) {
      messageSecretFingerprint = fingerprintSecret(input.messageSecret);
      messageSecretEnvelope = encryptSecret(input.messageSecret, this.encryptionKey);
    }

    const existing = this.metadataByPollId.get(pollId);

    const mergedOptions = new Map<string, PollMetadataOption>();
    for (const option of existing?.options ?? []) {
      if (option && option.id) {
        mergedOptions.set(option.id, option);
      }
    }
    for (const option of input.options ?? []) {
      if (option && option.id) {
        mergedOptions.set(option.id, option);
      }
    }

    const runtimeRecord: RuntimePollMetadata = {
      pollId,
      question: input.question ?? existing?.question ?? null,
      selectableOptionsCount:
        input.selectableOptionsCount ?? existing?.selectableOptionsCount ?? null,
      allowMultipleAnswers:
        input.allowMultipleAnswers ?? existing?.allowMultipleAnswers ?? null,
      options: Array.from(mergedOptions.values()),
      creationMessageId: input.creationMessageId ?? existing?.creationMessageId ?? null,
      creationMessageKey: input.creationMessageKey ?? existing?.creationMessageKey ?? null,
      messageSecretEnvelope: messageSecretEnvelope ?? existing?.messageSecretEnvelope ?? null,
      messageSecretFingerprint:
        messageSecretFingerprint ?? existing?.messageSecretFingerprint ?? null,
      messageSecretVersion:
        input.messageSecretVersion ?? existing?.messageSecretVersion ?? null,
      tenantId: input.tenantId ?? existing?.tenantId ?? null,
      instanceId: input.instanceId ?? existing?.instanceId ?? null,
      rawMessage: input.rawMessage ?? existing?.rawMessage ?? null,
      createdAt: existing?.createdAt ?? createdAt,
      updatedAt: new Date(now).toISOString(),
      expiresAt,
      hints: existing
        ? {
            receiptJids: new Set(existing.hints.receiptJids),
            creatorJids: new Set(existing.hints.creatorJids),
          }
        : {
            receiptJids: new Set<string>(),
            creatorJids: new Set<string>(),
          },
      votes: existing ? new Map(existing.votes) : new Map<string, StoredPollVote>(),
    };

    if (input.creatorJid) {
      runtimeRecord.hints.creatorJids.add(input.creatorJid);
    }

    this.metadataByPollId.set(pollId, runtimeRecord);
    if (runtimeRecord.creationMessageId) {
      this.pollIdByCreationId.set(runtimeRecord.creationMessageId, pollId);
    }

    this.schedulePersist();

    logger.debug('Poll runtime remembered poll creation', {
      pollId,
      expiresAt,
      creatorJid: input.creatorJid ?? null,
      tenantId: input.tenantId ?? null,
      instanceId: input.instanceId ?? null,
      options: runtimeRecord.options.length,
    });
  }

  async registerReceiptHint(input: RegisterReceiptHintInput): Promise<void> {
    await this.ensureInitialized();
    const pollId = input.pollId.trim();
    if (!pollId || !input.hintJid) {
      return;
    }

    const existing = this.metadataByPollId.get(pollId);
    if (!existing) {
      return;
    }

    existing.hints.receiptJids.add(input.hintJid);
    existing.updatedAt = new Date().toISOString();
    this.schedulePersist();
  }

  async recordVoteSelection(input: RecordVoteSelectionInput): Promise<void> {
    await this.ensureInitialized();

    const pollId = input.pollId.trim();
    const voterJid = input.voterJid.trim();

    if (!pollId || !voterJid) {
      return;
    }

    const existing = this.metadataByPollId.get(pollId);
    if (!existing) {
      return;
    }

    const nowIso = new Date().toISOString();
    const vote: StoredPollVote = {
      voterJid,
      optionIds: Array.from(new Set(input.optionIds ?? [])).map((id) => id.trim()).filter(Boolean),
      selectedOptions: input.selectedOptions.map((entry) => ({
        id: entry.id,
        title: entry.title ?? null,
      })),
      updatedAt: nowIso,
    };
    existing.votes.set(voterJid, vote);
    existing.updatedAt = nowIso;
    this.schedulePersist();
  }

  async mergeMetadata(payload: PollMetadataPayload): Promise<void> {
    await this.ensureInitialized();

    const pollId = payload.pollId.trim();
    if (!pollId) {
      return;
    }

    const entry = this.metadataByPollId.get(pollId);
    if (!entry) {
      await this.rememberPollCreation({
        pollId,
        question: payload.question ?? null,
        selectableOptionsCount: payload.selectableOptionsCount ?? null,
        allowMultipleAnswers: payload.allowMultipleAnswers ?? null,
        options: payload.options ?? [],
        creationMessageId: payload.creationMessageId ?? null,
        creationMessageKey: payload.creationMessageKey ?? null,
        messageSecret: payload.messageSecret ?? null,
        messageSecretVersion: payload.messageSecretVersion ?? null,
        tenantId: payload.tenantId ?? null,
        instanceId: payload.instanceId ?? null,
        rawMessage: null,
      });
      return;
    }

    const mergedOptions = new Map<string, PollMetadataOption>();
    for (const option of entry.options) {
      mergedOptions.set(option.id, option);
    }
    for (const option of payload.options ?? []) {
      mergedOptions.set(option.id, option);
    }

    entry.question = payload.question ?? entry.question ?? null;
    entry.selectableOptionsCount =
      payload.selectableOptionsCount ?? entry.selectableOptionsCount ?? null;
    entry.allowMultipleAnswers =
      payload.allowMultipleAnswers ?? entry.allowMultipleAnswers ?? null;
    entry.options = Array.from(mergedOptions.values());
    entry.creationMessageId = payload.creationMessageId ?? entry.creationMessageId ?? null;
    entry.creationMessageKey = payload.creationMessageKey ?? entry.creationMessageKey ?? null;
    entry.tenantId = payload.tenantId ?? entry.tenantId ?? null;
    entry.instanceId = payload.instanceId ?? entry.instanceId ?? null;

    if (payload.messageSecret && payload.messageSecret.trim().length > 0) {
      entry.messageSecretFingerprint = fingerprintSecret(payload.messageSecret);
      if (this.encryptionKey) {
        entry.messageSecretEnvelope = encryptSecret(payload.messageSecret, this.encryptionKey);
      }
    }

    entry.messageSecretVersion =
      payload.messageSecretVersion ?? entry.messageSecretVersion ?? null;
    entry.updatedAt = new Date().toISOString();

    if (entry.creationMessageId) {
      this.pollIdByCreationId.set(entry.creationMessageId, pollId);
    }

    this.schedulePersist();
  }

  async getPollMetadata(pollId: string): Promise<RuntimePollMetadata | null> {
    await this.ensureInitialized();
    const trimmed = pollId.trim();
    if (!trimmed) {
      return null;
    }

    const entry = this.metadataByPollId.get(trimmed);
    if (!entry) {
      return null;
    }

    return cloneMetadata(entry);
  }

  async getPollMetadataByCreationId(messageId: string | null | undefined): Promise<RuntimePollMetadata | null> {
    await this.ensureInitialized();
    if (!messageId || messageId.trim().length === 0) {
      return null;
    }

    const pollId = this.pollIdByCreationId.get(messageId.trim());
    if (!pollId) {
      return null;
    }

    return this.getPollMetadata(pollId);
  }

  async getVoteSelection(pollId: string, voterJid: string): Promise<StoredPollVote | null> {
    await this.ensureInitialized();
    const entry = this.metadataByPollId.get(pollId.trim());
    if (!entry) {
      return null;
    }

    return entry.votes.get(voterJid.trim()) ?? null;
  }

  async getDecryptedSecret(pollId: string): Promise<string | null> {
    await this.ensureInitialized();
    const entry = this.metadataByPollId.get(pollId.trim());
    if (!entry) {
      return null;
    }

    if (!entry.messageSecretEnvelope) {
      return null;
    }

    return decryptSecret(entry.messageSecretEnvelope, this.encryptionKey);
  }
}

export const pollRuntimeService = new PollRuntimeService();
