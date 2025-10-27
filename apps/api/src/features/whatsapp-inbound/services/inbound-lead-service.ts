/**
 * LeadEngine • WhatsApp Inbound Ingestion (Revised)
 *
 * Esta versão foi revisada e otimizada a partir do código original para
 * corrigir erros de tipagem do TypeScript, melhorar a legibilidade e
 * reduzir acoplamentos desnecessários. Destacam‑se as seguintes mudanças:
 *
 * - Remoção do atributo `chatId` das operações de upsert no fluxo de
 *   enquetes (poll_update), pois o modelo Prisma de Message não possui
 *   esse campo. O `chatId` continua sendo preservado em metadata.
 * - Eliminação do envio explícito de `ticketId: null` no create, já que
 *   campos string obrigatórios não aceitam null; quando necessário,
 *   simplesmente omitimos a propriedade.
 * - Simplificação do tratamento de `instanceId`: em vez de forçar a
 *   coação para null, passamos o valor diretamente (que pode ser
 *   `undefined` ou `null` conforme resolvido previamente), melhorando a
 *   consistência com o tipo `InboundWhatsAppEvent` revisado (string | null).
 * - Adição de comentários explicativos em pontos críticos do fluxo
 *   (deduplicação, enquete, processamento padrão) para facilitar
 *   manutenção e depuração.
 */

import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '@ticketz/core';
import { Prisma } from '@prisma/client';
import { enqueueInboundMediaJob } from '@ticketz/storage';

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { addAllocations } from '../../../data/lead-allocation-store';
import type { BrokerLeadRecord } from '../../../config/lead-engine';
import { maskDocument, maskPhone } from '../../../lib/pii';
import {
  inboundMessagesProcessedCounter,
  leadLastContactGauge,
  whatsappInboundMetrics,
} from '../../../lib/metrics';
import { createPerformanceTracker } from '../../../lib/performance-tracker';
import { createCache, cacheManager, type SimpleCache } from '../../../lib/simple-cache';
import {
  createTicket as createTicketService,
  sendMessage as sendMessageService,
} from '../../../services/ticket-service';
import { saveWhatsAppMedia } from '../../../services/whatsapp-media-service';
import {
  emitToAgreement,
  emitToTenant,
  emitToTicket,
} from '../../../lib/socket-registry';
import {
  normalizeInboundMessage,
  type NormalizedInboundMessage,
  type NormalizedMessageType,
} from '../utils/normalize';
import { emitWhatsAppDebugPhase } from '../../debug/services/whatsapp-debug-emitter';
import {
  DEFAULT_DEDUPE_TTL_MS,
  DEFAULT_TENANT_ID,
} from './constants';
import {
  registerDedupeKey,
  resetDedupeState,
  shouldSkipByDedupe,
} from './dedupe';
import { mapErrorForLog } from './logging';
import {
  pickPreferredName,
  readString,
  resolveBrokerIdFromMetadata,
  resolveDeterministicContactIdentifier,
  resolveTenantIdentifiersFromMetadata,
  sanitizeDocument,
  sanitizePhone,
  uniqueStringList,
} from './identifiers';
import { resolveTicketAgreementId } from './ticket-utils';
import {
  attemptAutoProvisionWhatsAppInstance,
  ensureInboundQueueForInboundMessage,
  getDefaultQueueId,
  isForeignKeyError,
  isUniqueViolation,
  provisionDefaultQueueForTenant,
  provisionFallbackCampaignForInstance,
  queueCacheByTenant,
  type WhatsAppInstanceRecord,
} from './provisioning';
import { downloadViaBaileys, downloadViaBroker } from './mediaDownloader';
import {
  type InboundMessageDetails,
  type InboundWhatsAppEnvelope,
  type InboundWhatsAppEnvelopeMessage,
  type InboundWhatsAppEvent,
} from './types';

/* ===========================================================================================
 * Helpers seguros e utilitários
 * ===========================================================================================
 */

// Converte valores potencialmente desconhecidos para registros (objetos com chave/valor).
const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

// Alias semântico para toRecord (melhora legibilidade).
const asRecord = toRecord;

// Verifica se uma string aparenta ser uma URL HTTP/HTTPS.
const isHttpUrl = (value: string | null | undefined): boolean =>
  typeof value === 'string' && /^https?:\/\//i.test(value.trim());

// Tenta converter um valor para string não vazia, retornando null caso contrário.
const readNullableString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

// Tenta converter um valor para número finito, retornando null caso contrário.
const readNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

// Conjunto de tipos de mensagem com mídia suportados.
const MEDIA_MESSAGE_TYPES = new Set<NormalizedMessageType>([
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'DOCUMENT',
]);

// Chaves possíveis de mídia bruta dentro do payload.
const RAW_MEDIA_MESSAGE_KEYS = [
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'stickerMessage',
] as const;

/**
 * Percorre recursivamente um registro para coletar objetos aninhados que possam conter
 * informações de mídia (diretamente ou como subcampos). Usa deduplicação para
 * evitar ciclos infinitos.
 */
const collectMediaRecords = (
  message: NormalizedInboundMessage,
  metadataRecord: Record<string, unknown>
): Record<string, unknown>[] => {
  const visited = new Set<Record<string, unknown>>();
  const records: Record<string, unknown>[] = [];

  const pushRecord = (value: unknown): void => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const record = value as Record<string, unknown>;
    if (visited.has(record)) return;
    visited.add(record);
    records.push(record);
    for (const key of ['media', 'attachment', 'file']) {
      if (key in record) pushRecord((record as any)[key]);
    }
  };

  const rawRecord = message.raw as Record<string, unknown>;
  pushRecord(rawRecord);
  pushRecord((rawRecord as any).metadata);
  pushRecord((rawRecord as any).message);
  pushRecord((rawRecord as any).imageMessage);
  pushRecord((rawRecord as any).videoMessage);
  pushRecord((rawRecord as any).audioMessage);
  pushRecord((rawRecord as any).documentMessage);
  pushRecord((rawRecord as any).stickerMessage);
  pushRecord(metadataRecord);
  if (metadataRecord.media && typeof metadataRecord.media === 'object' && !Array.isArray(metadataRecord.media)) {
    pushRecord(metadataRecord.media);
  }

  return records;
};

/**
 * Determina qual chave de mídia bruta (RAW_MEDIA_MESSAGE_KEYS) está presente em um
 * dado payload de mensagem normalizado. Retorna null caso nenhuma seja encontrada.
 */
const resolveRawMediaKey = (
  message: NormalizedInboundMessage
): (typeof RAW_MEDIA_MESSAGE_KEYS)[number] | null => {
  const rawRecord = message.raw as Record<string, unknown>;
  const candidateSources: Array<Record<string, unknown> | null> = [
    rawRecord,
    (rawRecord.message && typeof (rawRecord as any).message === 'object' && !Array.isArray((rawRecord as any).message)
      ? (rawRecord as any).message
      : null),
  ];
  for (const source of candidateSources) {
    if (!source) continue;
    for (const key of RAW_MEDIA_MESSAGE_KEYS) {
      if (key in source && (source as any)[key] && typeof (source as any)[key] === 'object') {
        return key;
      }
    }
  }
  return null;
};

/**
 * Extração de detalhes de mídia que serão utilizados para download (directPath,
 * mediaKey, fileName, mimeType, size) a partir de um NormalizedInboundMessage e
 * seu metadata. Prioriza campos presentes em message.mediaUrl e em registros
 * aninhados. Caso a URL seja HTTP/HTTPS, retorna null para directPath.
 */
const extractMediaDownloadDetails = (
  message: NormalizedInboundMessage,
  metadataRecord: Record<string, unknown>
) => {
  const records = collectMediaRecords(message, metadataRecord);
  const pickString = (...candidates: unknown[]): string | null => {
    for (const c of candidates) {
      const v = readNullableString(c);
      if (v) return v;
    }
    return null;
  };
  const pickNumber = (...candidates: unknown[]): number | null => {
    for (const c of candidates) {
      const v = readNullableNumber(c);
      if (v !== null) return v;
    }
    return null;
  };

  const directPathCandidate = pickString(
    ...(message.mediaUrl ? ([message.mediaUrl] as unknown[]) : []),
    ...records.flatMap((r) => [
      r['directPath'], r['direct_path'],
      r['downloadUrl'], r['download_url'],
      r['mediaUrl'], r['media_url'],
      r['url'],
    ])
  );

  const mediaKey = pickString(
    ...records.flatMap((r) => [
      r['mediaKey'], r['media_key'],
      r['fileSha256'], r['file_sha256'],
      r['mediaKeyTimestamp'],
    ])
  );

  const fileName = pickString(
    ...records.flatMap((r) => [
      r['fileName'], r['filename'], r['file_name'],
      r['fileNameEncryptedSha256'],
      r['name'], r['originalFilename'],
    ])
  );

  const mimeType = pickString(
    message.mimetype,
    ...records.flatMap((r) => [
      r['mimeType'], r['mimetype'],
      r['contentType'], r['content_type'],
      r['type'],
    ])
  );

  const size = pickNumber(
    message.fileSize,
    ...records.flatMap((r) => [r['fileLength'], r['file_length'], r['size'], r['length']])
  );

  return {
    directPath: directPathCandidate && !isHttpUrl(directPathCandidate) ? directPathCandidate : null,
    mediaKey: mediaKey ?? null,
    fileName: fileName ?? null,
    mimeType: mimeType ?? null,
    size: size ?? null,
    raw: message.raw,
    rawKey: resolveRawMediaKey(message),
  };
};

/* ===========================================================================================
 * Contatos, tags e tickets
 * ===========================================================================================
 */

/**
 * Reinicia estado interno de deduplicação e caches de filas (apenas para testes).
 */
// Cache de campanhas ativas por instância (TTL de 5 minutos)
const campaignCache: SimpleCache<string, Array<{ id: string; name: string; status: string; whatsappInstanceId: string | null; tenantId: string }>> = createCache({
  name: 'whatsapp-campaigns',
  ttlMs: 5 * 60 * 1000, // 5 minutos
  maxSize: 500,
});

// Registra o cache para limpeza automática
cacheManager.register(campaignCache);

export const resetInboundLeadServiceTestState = (): void => {
  resetDedupeState();
  queueCacheByTenant.clear();
  campaignCache.clear();
};

/**
 * Invalida cache de campanhas para uma instância específica
 * (deve ser chamado ao criar/atualizar/desativar campanhas)
 */
export const invalidateCampaignCache = (tenantId: string, instanceId: string): void => {
  const cacheKey = `${tenantId}:${instanceId}`;
  campaignCache.delete(cacheKey);
  logger.debug('Campaign cache invalidated', { tenantId, instanceId });
};

// Configurações de inclusão de relacionamentos para contatos.
const CONTACT_RELATIONS_INCLUDE = {
  tags: { include: { tag: true } },
  phones: true,
} satisfies Prisma.ContactInclude;

// Alias de tipo com relações para contato.
type PrismaContactWithRelations = Prisma.ContactGetPayload<{
  include: typeof CONTACT_RELATIONS_INCLUDE;
}>;

/**
 * Normaliza uma lista de nomes de tags, removendo entradas vazias e duplicadas.
 */
const normalizeTagNames = (values: string[] | undefined): string[] => {
  if (!values?.length) return [];
  const unique = new Set<string>();
  for (const entry of values) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (trimmed.length > 0) unique.add(trimmed);
  }
  return Array.from(unique);
};

/**
 * Extrai nomes de tags a partir de um contato com relações carregadas.
 */
const extractTagNames = (contact: PrismaContactWithRelations | null): string[] => {
  if (!contact?.tags?.length) return [];
  return contact.tags
    .map((assignment) => assignment.tag?.name ?? null)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
};

/**
 * Garante que todas as tags de `tagNames` existam no banco para o `tenantId`.
 * Retorna um Map nome → id com todas as tags (existentes ou recém criadas).
 */
const ensureTagsExist = async (
  tx: Prisma.TransactionClient,
  tenantId: string,
  tagNames: string[]
): Promise<Map<string, string>> => {
  if (!tagNames.length) return new Map();
  const existing = await tx.tag.findMany({ where: { tenantId, name: { in: tagNames } } });
  const tags = new Map(existing.map((t) => [t.name, t.id]));
  const missing = tagNames.filter((n) => !tags.has(n));
  if (missing.length > 0) {
    const created = await Promise.all(
      missing.map((name) => tx.tag.create({ data: { tenantId, name }, select: { id: true, name: true } }))
    );
    for (const t of created) tags.set(t.name, t.id);
  }
  return tags;
};

/**
 * Sincroniza as tags de um contato: remove associações ausentes e cria novas.
 */
const syncContactTags = async (
  tx: Prisma.TransactionClient,
  tenantId: string,
  contactId: string,
  tags: string[]
) => {
  const normalized = normalizeTagNames(tags);
  if (!normalized.length) {
    await tx.contactTag.deleteMany({ where: { tenantId, contactId } });
    return;
  }
  const tagsByName = await ensureTagsExist(tx, tenantId, normalized);
  const tagIds = normalized.map((n) => tagsByName.get(n)).filter((id): id is string => typeof id === 'string');

  // Remove associações que não devem mais existir.
  await tx.contactTag.deleteMany({ where: { tenantId, contactId, tagId: { notIn: tagIds } } });
  // Garante que cada tag desejada esteja associada ao contato.
  await Promise.all(
    tagIds.map((tagId) =>
      tx.contactTag.upsert({
        where: { contactId_tagId: { contactId, tagId } },
        update: {},
        create: { tenantId, contactId, tagId },
      })
    )
  );
};

/**
 * Insere ou atualiza o telefone principal de um contato. Caso um telefone já
 * exista em outro contato, a entrada é atualizada para apontar para o contato
 * atual e marcada como primária.
 */
const upsertPrimaryPhone = async (
  tx: Prisma.TransactionClient,
  tenantId: string,
  contactId: string,
  phone: string | null | undefined
) => {
  if (!phone) return;
  const trimmed = phone.trim();
  if (!trimmed) return;

  await tx.contactPhone.upsert({
    where: { tenantId_phoneNumber: { tenantId, phoneNumber: trimmed } },
    update: { contactId, isPrimary: true, updatedAt: new Date() },
    create: { tenantId, contactId, phoneNumber: trimmed, isPrimary: true },
  });

  // Demarca outros telefones do contato como não primários.
  await tx.contactPhone.updateMany({
    where: { tenantId, contactId, phoneNumber: { not: trimmed }, isPrimary: true },
    data: { isPrimary: false },
  });
};

/**
 * Localiza um contato pelo telefone principal ou documento (CPF/CNPJ). Retorna
 * null caso nenhum seja encontrado.
 */
const findContactByPhoneOrDocument = async (
  tenantId: string,
  phone?: string | null,
  document?: string | null
): Promise<PrismaContactWithRelations | null> => {
  const conditions: Prisma.ContactWhereInput[] = [];
  if (phone?.trim()) {
    conditions.push({ primaryPhone: phone.trim() });
    conditions.push({ phones: { some: { phoneNumber: phone.trim() } } });
  }
  if (document?.trim()) {
    conditions.push({ document: document.trim() });
  }
  if (!conditions.length) return null;

  return prisma.contact.findFirst({
    where: { tenantId, OR: conditions },
    include: CONTACT_RELATIONS_INCLUDE,
  });
};

/**
 * Garante que um contato exista (update ou create). Atualiza campos como nome,
 * telefone principal, documento, avatar e campos personalizados. Também
 * sincroniza tags e telefones associados ao contato.
 */
const ensureContact = async (
  tenantId: string,
  {
    phone,
    name,
    document,
    registrations,
    timestamp,
    avatar,
  }: {
    phone?: string | null | undefined;
    name?: string | null | undefined;
    document?: string | null | undefined;
    registrations?: string[] | null | undefined;
    timestamp?: string | null | undefined;
    avatar?: string | null | undefined;
  }
): Promise<PrismaContactWithRelations> => {
  const interactionDate = timestamp ? new Date(timestamp) : new Date();
  const interactionTimestamp = interactionDate.getTime();
  const interactionIso = interactionDate.toISOString();

  const existing = await findContactByPhoneOrDocument(tenantId, phone ?? null, document ?? null);
  const existingTags = extractTagNames(existing);
  const tags = normalizeTagNames([...existingTags, 'whatsapp', 'inbound']);

  // Constrói campos personalizados, reaproveitando eventuais customFields existentes.
  const customFieldsSource =
    existing?.customFields && typeof existing.customFields === 'object'
      ? (existing.customFields as Record<string, unknown>)
      : {};

  const cfs: Record<string, unknown> = {
    ...customFieldsSource,
    source: 'whatsapp',
    lastInboundChannel: 'whatsapp',
  };

  if (registrations && registrations.length > 0) cfs.registrations = registrations;
  else if (!('registrations' in cfs)) cfs.registrations = [];

  // Garante que o campo de consentimento exista.
  if (!('consent' in cfs)) {
    cfs.consent = { granted: true, base: 'legitimate_interest', grantedAt: interactionIso };
  }

  // Helpers para verificar se uma timestamp é válida.
  const parseTs = (v: unknown): number | null => {
    if (typeof v === 'string') {
      const p = Date.parse(v);
      return Number.isNaN(p) ? null : p;
    }
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    return null;
  };

  // Atualiza timestamps de primeiro e último inbound.
  const currentFirst = parseTs(cfs['firstInboundAt']);
  if (currentFirst === null || interactionTimestamp < currentFirst) cfs['firstInboundAt'] = interactionIso;

  const currentLast = parseTs(cfs['lastInboundAt']);
  if (currentLast === null || interactionTimestamp >= currentLast) cfs['lastInboundAt'] = interactionIso;

  const resolvedName =
    name?.trim() || existing?.fullName?.trim() || 'Contato WhatsApp';

  const normalizedPhone = phone?.trim() ?? existing?.primaryPhone ?? null;

  // Dados que serão usados no update/create do contato.
  const contactData: Prisma.ContactUpdateInput = {
    fullName: resolvedName,
    displayName: resolvedName,
    primaryPhone: normalizedPhone,
    document: document ?? existing?.document ?? null,
    avatar: avatar ?? existing?.avatar ?? null,
    customFields: cfs as Prisma.InputJsonValue,
    lastInteractionAt: interactionDate,
    lastActivityAt: interactionDate,
  };

  const persisted = await prisma.$transaction(async (tx) => {
    // Otimização: include apenas no update/create, eliminando query adicional
    const target =
      existing !== null
        ? await tx.contact.update({
            where: { id: existing.id },
            data: contactData,
            include: CONTACT_RELATIONS_INCLUDE,
          })
        : await tx.contact.create({
            data: {
              tenantId,
              fullName: resolvedName,
              displayName: resolvedName,
              primaryPhone: normalizedPhone,
              document: document ?? null,
              avatar: avatar ?? null,
              customFields: cfs as Prisma.InputJsonValue,
              lastInteractionAt: interactionDate,
              lastActivityAt: interactionDate,
            },
            include: CONTACT_RELATIONS_INCLUDE,
          });

    await upsertPrimaryPhone(tx, tenantId, target.id, normalizedPhone ?? undefined);
    await syncContactTags(tx, tenantId, target.id, tags);

    // Retorna diretamente o target com relações já carregadas
    return target;
  });

  return persisted;
};

/**
 * Verifica se um erro indica ausência de fila padrão ou FK quebrada.
 */
const isMissingQueueError = (error: unknown): boolean => {
  if (!error) return false;
  if (error instanceof NotFoundError) return true;
  if (isForeignKeyError(error)) return true;

  if (typeof error === 'object' && error !== null) {
    if (error instanceof Error && error.name === 'NotFoundError') return true;
    const cause = (error as { cause?: unknown }).cause;
    if (cause && cause !== error) return isMissingQueueError(cause);
  }
  return false;
};

/**
 * Garante a existência de um ticket para um determinado contato e fila. Trata
 * conflitos (quando já há ticket aberto) e ausências de fila padrão, com
 * provisionamento automático quando necessário.
 */
const ensureTicketForContact = async (
  tenantId: string,
  contactId: string,
  queueId: string,
  subject: string,
  metadata: Record<string, unknown>
): Promise<string | null> => {
  const createTicketWithQueue = async (targetQueueId: string) =>
    createTicketService({
      tenantId,
      contactId,
      queueId: targetQueueId,
      channel: 'WHATSAPP',
      priority: 'NORMAL',
      subject,
      tags: ['whatsapp', 'inbound'],
      metadata,
    });

  try {
    const ticket = await createTicketWithQueue(queueId);
    return ticket.id;
  } catch (error: unknown) {
    // Se houver conflito (ticket já existe), retorna o ID existente.
    if (error instanceof ConflictError) {
      const details = (error.details ?? {}) as Record<string, unknown>;
      const existingTicketId = typeof details.existingTicketId === 'string' ? details.existingTicketId : undefined;
      if (existingTicketId) return existingTicketId;
    }

    if (isMissingQueueError(error)) {
      // Tenta atualizar cache de fila e reprocessar a criação do ticket.
      queueCacheByTenant.delete(tenantId);
      let refreshedQueueId: string | null = null;

      try {
        refreshedQueueId = await getDefaultQueueId(tenantId, { provisionIfMissing: false });
      } catch (refreshError) {
        logger.warn('Failed to refresh WhatsApp queue after missing queue error', {
          error: mapErrorForLog(refreshError), tenantId, contactId,
        });
      }

      if (!refreshedQueueId) {
        try {
          refreshedQueueId = await provisionDefaultQueueForTenant(tenantId);
        } catch (provisionError) {
          logger.error('Failed to ensure WhatsApp ticket for contact after queue refresh', {
            error: mapErrorForLog(provisionError), tenantId, contactId,
          });
          return null;
        }
      }

      if (refreshedQueueId) {
        try {
          const ticket = await createTicketWithQueue(refreshedQueueId);
          return ticket.id;
        } catch (retryError) {
          if (retryError instanceof ConflictError) {
            const details = (retryError.details ?? {}) as Record<string, unknown>;
            const existingTicketId = typeof details.existingTicketId === 'string' ? details.existingTicketId : undefined;
            if (existingTicketId) return existingTicketId;
          }
          logger.error('Failed to ensure WhatsApp ticket for contact after queue refresh', {
            error: mapErrorForLog(retryError), tenantId, contactId,
          });
          return null;
        }
      }
    }

    logger.error('Failed to ensure WhatsApp ticket for contact', { error: mapErrorForLog(error), tenantId, contactId });
    return null;
  }
};

/* ===========================================================================================
 * Realtime e Lead
 * ===========================================================================================
 */

/**
 * Emite eventos realtime após salvar uma mensagem inbound. Se `emitTicketRealtimeEvents`
 * for false, considera que a criação de mensagem já emitiu esses eventos.
 */
const emitRealtimeUpdatesForInbound = async ({
  tenantId,
  ticketId,
  instanceId,
  message,
  providerMessageId,
  emitTicketRealtimeEvents = true,
}: {
  tenantId: string;
  ticketId: string;
  instanceId: string | null;
  message: Awaited<ReturnType<typeof sendMessageService>>;
  providerMessageId: string | null;
  emitTicketRealtimeEvents?: boolean;
}) => {
  const messageMetadata = message.metadata && typeof message.metadata === 'object'
    ? (message.metadata as Record<string, unknown>)
    : {};
  const eventMetadata = messageMetadata.eventMetadata && typeof messageMetadata.eventMetadata === 'object'
    ? (messageMetadata.eventMetadata as Record<string, unknown>)
    : {};
  const requestId =
    typeof eventMetadata.requestId === 'string' && eventMetadata.requestId.trim().length > 0
      ? eventMetadata.requestId : null;

  if (!emitTicketRealtimeEvents) {
    logger.info('🎯 LeadEngine • WhatsApp :: 🔕 Eventos realtime já propagados na criação da mensagem', {
      requestId, tenantId, ticketId, messageId: message.id, providerMessageId, agreementId: null,
    });
    return;
  }

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      logger.warn('Inbound realtime event skipped: ticket record missing', { tenantId, ticketId, messageId: message.id });
      return;
    }

    const agreementId = resolveTicketAgreementId(ticket);
    const ticketPayload = {
      tenantId,
      ticketId,
      agreementId,
      instanceId: instanceId ?? null,
      messageId: message.id, providerMessageId,
      ticketStatus: ticket.status,
      ticketUpdatedAt: ticket.updatedAt?.toISOString?.() ?? new Date().toISOString(),
      ticket,
    };

    emitToTicket(ticketId, 'tickets.updated', ticketPayload);
    emitToTenant(tenantId, 'tickets.updated', ticketPayload);
    if (agreementId) emitToAgreement(agreementId, 'tickets.updated', ticketPayload);

    logger.info('🎯 LeadEngine • WhatsApp :: 🔔 Eventos realtime propagados', {
      requestId, tenantId, ticketId, messageId: message.id, providerMessageId, agreementId,
    });
  } catch (error) {
    logger.error('Failed to emit realtime updates for inbound WhatsApp message', {
      error: mapErrorForLog(error), tenantId, ticketId, messageId: message.id,
    });
  }
};

/**
 * Atualiza ou cria um lead a partir de uma mensagem inbound. Cria LeadActivity
 * correspondente e emite eventos realtime para leads e atividades. Reutiliza
 * LeadActivity existente se mensagem já tiver sido registrada.
 */
const upsertLeadFromInbound = async ({
  tenantId,
  contactId,
  ticketId,
  instanceId,
  providerMessageId,
  message,
}: {
  tenantId: string;
  contactId: string;
  ticketId: string;
  instanceId: string;
  providerMessageId: string | null;
  message: Awaited<ReturnType<typeof sendMessageService>>;
}) => {
  const lastContactAt = message.createdAt instanceof Date ? message.createdAt : new Date();

  const messageMetadata =
    message.metadata && typeof message.metadata === 'object'
      ? (message.metadata as Record<string, unknown>)
      : {};
  const eventMetadata =
    messageMetadata.eventMetadata && typeof messageMetadata.eventMetadata === 'object'
      ? (messageMetadata.eventMetadata as Record<string, unknown>)
      : {};
  const messageRequestId =
    typeof eventMetadata.requestId === 'string' && eventMetadata.requestId.trim().length > 0
      ? eventMetadata.requestId
      : null;

  const preview =
    typeof message.content === 'string' && message.content.trim().length > 0
      ? message.content.trim().slice(0, 140)
      : null;

  // Operação idempotente: upsert garante que não haverá duplicação mesmo com retries
  const lead = await prisma.lead.upsert({
    where: {
      tenantId_contactId: { tenantId, contactId },
    },
    update: {
      lastContactAt,
    },
    create: {
      tenantId,
      contactId,
      status: 'NEW',
      source: 'WHATSAPP',
      lastContactAt,
    },
  });

  leadLastContactGauge.set({ tenantId, leadId: lead.id }, lastContactAt.getTime());

  const metadata: Record<string, unknown> = {
    ticketId, instanceId, providerMessageId,
    messageId: message.id, contactId,
    direction: message.direction,
  };
  if (preview) metadata.preview = preview;
  if (messageRequestId) metadata.requestId = messageRequestId;

  const existingLeadActivity = await prisma.leadActivity.findFirst({
    where: {
      tenantId,
      leadId: lead.id,
      type: 'WHATSAPP_REPLIED',
      metadata: { path: ['messageId'], equals: message.id },
    },
  });

  if (existingLeadActivity) {
    logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Lead activity reaproveitada', {
      tenantId, leadId: lead.id, ticketId, messageId: message.id,
    });
    return { lead, leadActivity: existingLeadActivity };
  }

  const leadActivity = await prisma.leadActivity.create({
    data: {
      tenantId,
      leadId: lead.id,
      type: 'WHATSAPP_REPLIED',
      title: 'Mensagem recebida pelo WhatsApp',
      metadata: metadata as Prisma.InputJsonValue,
      occurredAt: lastContactAt,
    },
  });

  const realtimeEnvelope = { tenantId, ticketId, instanceId, providerMessageId, message, lead, leadActivity };

  try {
    emitToTenant(tenantId, 'leads.updated', realtimeEnvelope);
    emitToTicket(ticketId, 'leads.updated', realtimeEnvelope);
  } catch (error) {
    logger.error('Failed to emit lead realtime updates for inbound WhatsApp message', {
      error: mapErrorForLog(error), tenantId, ticketId, leadId: lead.id, messageId: message.id,
    });
  }

  try {
    emitToTenant(tenantId, 'leadActivities.new', realtimeEnvelope);
    emitToTicket(ticketId, 'leadActivities.new', realtimeEnvelope);
  } catch (error) {
    logger.error('Failed to emit lead activity realtime updates for inbound WhatsApp message', {
      error: mapErrorForLog(error), tenantId, ticketId, leadId: lead.id, messageId: message.id,
    });
  }

  return { lead, leadActivity };
};

/* ===========================================================================================
 * Resolvedores do envelope
 * ===========================================================================================
 */

/**
 * Resolve o chatId de um envelope inbound: procura no próprio envelope, no payload
 * e nas chaves (key) associadas à mensagem.
 */
const resolveEnvelopeChatId = (
  envelope: InboundWhatsAppEnvelopeMessage
): string | null => {
  const provided = readString(envelope.chatId);
  if (provided) return provided;

  const payloadRecord = toRecord(envelope.message.payload);
  if (payloadRecord.chatId) {
    const candidate = readString((payloadRecord as any).chatId);
    if (candidate) return candidate;
  }

  const keyRecord = toRecord((payloadRecord as any).key);
  return readString((keyRecord as any).remoteJid) ?? readString((keyRecord as any).jid) ?? null;
};

/**
 * Resolve o messageId de um envelope inbound: procura nos campos de identificação
 * padrão e nas chaves (key) associadas à mensagem.
 */
const resolveEnvelopeMessageId = (
  envelope: InboundWhatsAppEnvelopeMessage
): string | null => {
  const payloadRecord = toRecord(envelope.message.payload);
  const keyRecord = toRecord((payloadRecord as any).key);

  return (
    readString(envelope.message.externalId) ??
    readString(envelope.message.brokerMessageId) ??
    readString(envelope.message.id) ??
    readString((payloadRecord as any).id) ??
    readString((keyRecord as any).id)
  );
};

/**
 * Concatena e normaliza metadata do envelope: garante que campos comuns (chatId,
 * tenantId, tenant, context, integration, sessionId) estejam definidos quando
 * possíveis, priorizando valores do payload e, em último caso, do envelope.
 */
const mergeEnvelopeMetadata = (
  envelope: InboundWhatsAppEnvelopeMessage,
  chatId: string | null
): Record<string, unknown> => {
  const base = toRecord(envelope.message.metadata);
  const payloadRecord = toRecord(envelope.message.payload);

  if (!(base as any).chatId && chatId) (base as any).chatId = chatId;

  if (!(base as any).tenantId) {
    const payloadTenantId = readString((payloadRecord as any).tenantId);
    if (payloadTenantId) (base as any).tenantId = payloadTenantId;
    else if (envelope.tenantId) (base as any).tenantId = envelope.tenantId;
  }

  if (!(base as any).tenant) {
    const payloadTenant = toRecord((payloadRecord as any).tenant);
    if (Object.keys(payloadTenant).length > 0) (base as any).tenant = payloadTenant;
  }

  if (!(base as any).context) {
    const payloadContext = toRecord((payloadRecord as any).context);
    if (Object.keys(payloadContext).length > 0) (base as any).context = payloadContext;
  }

  if (!(base as any).integration) {
    const payloadIntegration = toRecord((payloadRecord as any).integration);
    if (Object.keys(payloadIntegration).length > 0) (base as any).integration = payloadIntegration;
  }

  if (!(base as any).sessionId) {
    const payloadSessionId = readString((payloadRecord as any).sessionId);
    if (payloadSessionId) (base as any).sessionId = payloadSessionId;
  }

  if (!(base as any).instanceId) (base as any).instanceId = envelope.instanceId;
  if (envelope.raw && !(base as any).rawEnvelope) (base as any).rawEnvelope = envelope.raw;

  return base;
};

/* ===========================================================================================
 * Heurística de ENQUETE (poll_update)
 * ===========================================================================================
 */

// Tipo que representa o voto em uma enquete.
type PollVote = {
  pollId: string | null;
  question: string | null;
  choiceText: string | null;
};

// Constrói mensagem legível para voto em enquete.
const buildPollVoteText = (q: string | null, c: string | null) => {
  if (q && c) return `Obrigado! Você votou em "${c}" para "${q}".`;
  if (c) return `Obrigado! Seu voto: "${c}".`;
  if (q) return `Obrigado! Seu voto foi registrado para a enquete: "${q}".`;
  return 'Obrigado! Seu voto foi registrado.';
};

/**
 * Resolve o tipo de mensagem do envelope (usado para identificar poll_update).
 */
const resolveMessageType = (envelope: InboundWhatsAppEnvelope): string | null => {
  const p = asRecord((envelope as any)?.message?.payload);
  const meta = asRecord((p as any).metadata);
  const msg = asRecord((p as any).message);
  return readString((msg as any).type) ?? readString((meta as any).messageType);
};

/**
 * Resolve o chatId para deduplicação de alta camada (usado antes de extrair
 * metadata de payload). Considera diversos campos de contexto.
 */
const resolveChatId = (envelope: InboundWhatsAppEnvelope): string | null => {
  const p = asRecord((envelope as any)?.message?.payload);
  const meta = asRecord((p as any).metadata);
  const key = asRecord(asRecord((p as any).message).key);

  return (
    readString((meta as any).chatId) ??
    readString((meta as any).remoteJid) ??
    readString(asRecord((p as any).contact).remoteJid as string) ??
    readString((key as any).remoteJid) ??
    readString((envelope as any).chatId) ??
    null
  );
};

/**
 * Resolve o messageId para deduplicação (antes de extrair metadata de payload).
 */
const resolveMessageId = (envelope: InboundWhatsAppEnvelope): string | null => {
  const p = asRecord((envelope as any)?.message?.payload);
  const msg = asRecord((p as any).message);
  return (
    readString((msg as any).id) ??
    readString((p as any).id) ??
    readString((envelope as any)?.message?.id) ??
    null
  );
};

/**
 * Extrai informações de voto de enquete a partir do payload.
 */
const extractPollVote = (payload: unknown): PollVote => {
  const p = asRecord(payload);
  const meta = asRecord((p as any).metadata);
  const message = asRecord((p as any).message);
  const pick = (v: unknown) => readString(v);

  const choiceText =
    pick((message as any).text) ??
    pick((meta as any)?.pollChoice?.vote?.selectedOptions?.[0]?.title) ??
    pick((meta as any)?.pollChoice?.vote?.selectedOptions?.[0]?.text) ??
    pick((meta as any)?.poll?.selectedOptions?.[0]?.title) ??
    pick((meta as any)?.poll?.selectedOptions?.[0]?.text) ??
    pick((meta as any)?.pollChoice?.vote?.optionIds?.[0]) ??
    pick((meta as any)?.poll?.selectedOptionIds?.[0]) ??
    null;

  const question =
    pick((meta as any)?.poll?.question) ??
    pick((meta as any)?.pollChoice?.question) ??
    pick((p as any)?.question) ??
    null;

  const pollId =
    pick((meta as any)?.poll?.id) ??
    pick((meta as any)?.poll?.pollId) ??
    pick((meta as any)?.pollChoice?.pollId) ??
    pick((p as any)?.pollId) ??
    pick((p as any)?.id) ??
    pick((message as any)?.id) ??
    null;

  return { pollId, question, choiceText };
};

/* ===========================================================================================
 * Função principal de ingestão
 * ===========================================================================================
 */

/**
 * Ingestão de envelope inbound do WhatsApp. Trata deduplicação, votos em enquete
 * (poll_update) e delega o processamento padrão para a pipeline completa
 * (mídia, ticket, lead, realtime, alocação). Retorna true caso a mensagem
 * tenha sido persistida; false caso contrário.
 */
export const ingestInboundWhatsAppMessage = async (
  envelope: InboundWhatsAppEnvelope
): Promise<boolean> => {
  const perfTracker = createPerformanceTracker({ operation: 'ingestInboundWhatsAppMessage' });
  perfTracker.start('total');

  // Proteção inicial: envelope ou mensagem malformada.
  if (!envelope || !(envelope as any).message) {
    logger.warn('whatsappInbound.ingest.malformedEnvelope', { envelopeKeys: Object.keys(envelope || {}) });
    inboundMessagesProcessedCounter.inc({
      origin: 'webhook',
      tenantId: readString((envelope as any).tenantId) ?? 'unknown',
      instanceId: readString((envelope as any).instanceId) ?? 'unknown',
    });
    return false;
  }

  // Determina tipo de mensagem para identificar enquetes.
  const msgType = resolveMessageType(envelope);
  const isPollUpdate = msgType === 'poll_update';

  // Garante que existe payload de mensagem ou metadata antes de prosseguir.
  const payload = asRecord((envelope as any)?.message?.payload);
  if (!Object.keys(asRecord((payload as any).message)).length && !Object.keys(asRecord((payload as any).metadata)).length) {
    logger.debug('whatsappInbound.ingest.skipNonMessage', {
      origin: (envelope as any).origin,
      instanceId: (envelope as any).instanceId,
      updateId: (envelope as any).message?.id,
      msgType,
    });
    inboundMessagesProcessedCounter.inc({
      origin: 'webhook',
      tenantId: readString((envelope as any).tenantId) ?? 'unknown',
      instanceId: readString((envelope as any).instanceId) ?? 'unknown',
    });
    return false;
  }

  // Extrai campos base do envelope (chatId, externalId, instanceId, tenantId).
  const metaIn = asRecord((payload as any).metadata);
  const chatId = resolveChatId(envelope);
  const externalId = resolveMessageId(envelope) ?? randomUUID();
  const instanceId = readString((metaIn as any).instanceId) ?? readString((envelope as any).instanceId);
  const tenantId = readString((metaIn as any).tenantId) ?? readString((envelope as any).tenantId) ?? DEFAULT_TENANT_ID;

  // Tratamento especial de voto em enquete: gera texto legível e persiste mensagem simples.
  if (isPollUpdate) {
    const { pollId, question, choiceText } = extractPollVote(payload);

    if (choiceText || question) {
      // Quando a enquete possui texto legível, injeta uma mensagem de texto na timeline
      // e define o metadata apropriado para que a pipeline padrão processe normalmente.
      const finalText = buildPollVoteText(question, choiceText);

      // Construímos nova mensagem tipo TEXT e substituímos o payload.message
      (payload as any).message = {
        type: 'TEXT',
        text: finalText,
        // Define um id para a mensagem, reaproveitando o id do envelope se existir
        id: (envelope as any)?.message?.id ?? externalId,
      };

      // Define metadata consistente com a pipeline, preservando informações essenciais
      (payload as any).metadata = {
        ...metaIn,
        placeholder: false,
        direction: 'INBOUND',
        chatId: chatId ?? undefined,
        source: { channel: 'whatsapp', transport: 'baileys', event: 'poll_update' },
        poll: {
          id: pollId ?? undefined,
          question: question ?? undefined,
          selectedOptions: choiceText ? [{ id: choiceText, title: choiceText }] : undefined,
          updatedAt: new Date().toISOString(),
        },
        pollChoice: {
          pollId: pollId ?? undefined,
          question: question ?? undefined,
          vote: {
            selectedOptions: choiceText ? [{ id: choiceText, title: choiceText }] : undefined,
            optionIds: choiceText ? [choiceText] : undefined,
            timestamp: readString((payload as any).timestamp) ?? new Date().toISOString(),
          },
        },
      };
    } else {
      // Se não houver texto legível: marca placeholder em metadata e segue pipeline padrão.
      (payload as any).metadata = {
        ...metaIn,
        placeholder: true,
        direction: 'INBOUND',
        source: { channel: 'whatsapp', transport: 'baileys', event: 'poll_update' },
        poll: {
          ...(asRecord((metaIn as any).poll)),
          id: asRecord((metaIn as any).poll).id ?? pollId ?? undefined,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    // Após configurar o payload para enquetes, não retorna aqui. A pipeline padrão
    // continuará e cuidará de persistir a mensagem e disparar os eventos necessários.
  }

  // Pipeline padrão (inclusive para poll_update sem texto).
  const now = Date.now();

  // Constrói metadata consolidada para a mensagem.
  const metadata = mergeEnvelopeMetadata(
    {
      ...(envelope as any),
      message: (envelope as InboundWhatsAppEnvelopeMessage).message,
    } as InboundWhatsAppEnvelopeMessage,
    chatId
  );

  // Chave de deduplicação para o fluxo ingest (envolve tenant, instance, chat e mensagem).
  const messageId = externalId;
  const keyChatId = chatId ?? '__unknown__';
  const dedupeKey = `${tenantId}:${instanceId ?? 'null'}:${keyChatId}:${messageId}`;

  emitWhatsAppDebugPhase({
    phase: 'ingest:received',
    correlationId: messageId,
    tenantId,
    instanceId: instanceId ?? null,
    chatId,
    tags: ['ingest'],
    context: { origin: (envelope as any).origin, dedupeKey, dedupeTtlMs: DEFAULT_DEDUPE_TTL_MS },
    payload: { message: payload, metadata },
  });

  if (await shouldSkipByDedupe(dedupeKey, now, DEFAULT_DEDUPE_TTL_MS)) {
    logger.info('whatsappInbound.ingest.dedupeSkip', {
      origin: (envelope as any).origin,
      instanceId, tenantId, chatId: keyChatId,
      messageId, dedupeKey, dedupeTtlMs: DEFAULT_DEDUPE_TTL_MS,
    });
    emitWhatsAppDebugPhase({
      phase: 'ingest:dedupe-skipped',
      correlationId: messageId,
      tenantId,
      instanceId,
      chatId,
      tags: ['ingest'],
      context: { origin: (envelope as any).origin, dedupeKey, dedupeTtlMs: DEFAULT_DEDUPE_TTL_MS },
    });
    return false;
  }

  // Constrói o evento inbound para processar na pipeline padrão. Note que
  // instanceId pode ser null/undefined, conforme tipo revisado (string | null).
  const event: InboundWhatsAppEvent = {
    id: (envelope as any).message.id ?? messageId,
    instanceId: instanceId ?? null,
    direction: (envelope as any).message.direction,
    chatId,
    externalId: (envelope as any).message.externalId ?? messageId,
    timestamp: (envelope as any).message.timestamp ?? null,
    contact: (envelope as any).message.contact ?? {},
    message: payload,
    metadata,
    tenantId,
    sessionId: readString((metadata as any).sessionId),
  };

  const persisted = await processStandardInboundEvent(event, now, { preloadedInstance: null });

  if (persisted) await registerDedupeKey(dedupeKey, now, DEFAULT_DEDUPE_TTL_MS);

  emitWhatsAppDebugPhase({
    phase: persisted ? 'ingest:completed' : 'ingest:failed',
    correlationId: messageId, tenantId, instanceId, chatId,
    tags: ['ingest'],
    context: { origin: (envelope as any).origin, dedupeKey, dedupeTtlMs: DEFAULT_DEDUPE_TTL_MS, persisted },
    payload: { event },
  });

  inboundMessagesProcessedCounter.inc({ origin: 'webhook', tenantId, instanceId: instanceId ?? 'unknown' });

  return persisted;
};

/* ===========================================================================================
 * Pipeline padrão: mídia, ticket, lead, realtime, alocação
 * ===========================================================================================
 */

/**
 * Processa evento inbound normalizado: resolve instância, contato, ticket,
 * download de mídia (sincrono ou em background), insere mensagem na timeline,
 * sincroniza lead e alocação. Retorna true se mensagem persistida.
 */
const processStandardInboundEvent = async (
  event: InboundWhatsAppEvent,
  now: number,
  { preloadedInstance }: { preloadedInstance?: WhatsAppInstanceRecord | null }
): Promise<boolean> => {
  const {
    instanceId,
    contact,
    message,
    timestamp,
    direction,
    chatId,
    externalId,
    tenantId: eventTenantId,
    sessionId: eventSessionId,
  } = event;

  // Se instanceId estiver vazio ou só espaços, normaliza para null.
  const instanceIdentifier =
    typeof instanceId === 'string' && instanceId.trim().length > 0 ? instanceId.trim() : null;
  const normalizedPhone = sanitizePhone(contact.phone);
  const metadataRecord = toRecord(event.metadata);
  const metadataContact = toRecord(metadataRecord.contact);
  const deterministicIdentifiers = resolveDeterministicContactIdentifier({
    instanceId: instanceIdentifier,
    metadataRecord,
    metadataContact,
    sessionId:
      readString(eventSessionId) ?? readString(metadataRecord.sessionId) ?? readString((metadataRecord as any).session_id),
    externalId: externalId ?? null,
  });
  const document = sanitizeDocument(contact.document, [
    normalizedPhone,
    deterministicIdentifiers.deterministicId,
    deterministicIdentifiers.contactId,
    deterministicIdentifiers.sessionId,
    instanceIdentifier,
  ]);
  const requestId = readString((metadataRecord as any)['requestId']);
  const resolvedBrokerId = resolveBrokerIdFromMetadata(metadataRecord);
  const metadataTenantRecord = toRecord((metadataRecord as any).tenant);
  const metadataPushName = readString((metadataContact as any)['pushName']) ?? readString((metadataRecord as any)['pushName']);
  const resolvedAvatar = [
    (contact as any).avatarUrl,
    (metadataContact as any).avatarUrl,
    (metadataContact as any).profilePicUrl,
    (metadataContact as any).profilePicture,
  ].find((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const resolvedName = pickPreferredName(contact.name, (contact as any).pushName, metadataPushName);

  // Normaliza tenantId vindo do evento/metadata.
  const normalizedEventTenantId =
    typeof eventTenantId === 'string' && eventTenantId.trim().length > 0 ? eventTenantId.trim() : null;
  let metadataTenantId = readString((metadataRecord as any)['tenantId']);

  if (normalizedEventTenantId) {
    if (!metadataTenantId || metadataTenantId !== normalizedEventTenantId) {
      (metadataRecord as any).tenantId = normalizedEventTenantId;
      metadataTenantId = normalizedEventTenantId;
    }
  } else if (eventTenantId && !metadataTenantId) {
    (metadataRecord as any).tenantId = eventTenantId;
    metadataTenantId = eventTenantId;
  }

  // Garante que metadata.tenant tenha id e tenantId preenchidos.
  if (metadataTenantId) {
    let tenantRecordUpdated = false;
    const tenantRecordId = readString((metadataTenantRecord as any)['id']);
    if (!tenantRecordId || tenantRecordId !== metadataTenantId) {
      (metadataTenantRecord as any)['id'] = metadataTenantId;
      tenantRecordUpdated = true;
    }
    const tenantRecordTenantId = readString((metadataTenantRecord as any)['tenantId']);
    if (!tenantRecordTenantId || tenantRecordTenantId !== metadataTenantId) {
      (metadataTenantRecord as any)['tenantId'] = metadataTenantId;
      tenantRecordUpdated = true;
    }
    if (tenantRecordUpdated || (!metadataRecord.tenant && Object.keys(metadataTenantRecord).length > 0)) {
      (metadataRecord as any).tenant = metadataTenantRecord;
    }
  }

  const tenantIdForBrokerLookup = normalizedEventTenantId ?? metadataTenantId ?? null;

  (metadataRecord as any).direction = direction;
  if (chatId && !(metadataRecord as any).chatId) (metadataRecord as any).chatId = chatId;
  if (eventSessionId && !(metadataRecord as any).sessionId) (metadataRecord as any).sessionId = eventSessionId;

  // Atualiza broker metadata.
  const metadataBroker =
    (metadataRecord as any).broker && typeof (metadataRecord as any).broker === 'object'
      ? ((metadataRecord as any).broker as Record<string, unknown>)
      : null;
  if (metadataBroker) {
    (metadataBroker as any).direction = direction;
    (metadataBroker as any).instanceId = (metadataBroker as any).instanceId ?? instanceId;
    if (resolvedBrokerId && (!(metadataBroker as any).id || (metadataBroker as any).id !== resolvedBrokerId)) {
      (metadataBroker as any).id = resolvedBrokerId;
    }
  } else {
    (metadataRecord as any).broker = { direction, instanceId, ...(resolvedBrokerId ? { id: resolvedBrokerId } : {}) };
  }

  if (resolvedBrokerId && (!(metadataRecord as any).brokerId || (metadataRecord as any).brokerId !== resolvedBrokerId)) {
    (metadataRecord as any).brokerId = resolvedBrokerId;
  }

  logger.info('🎯 LeadEngine • WhatsApp :: ✉️ Processando mensagem WhatsApp', {
    requestId,
    instanceId,
    messageId: (message as any).id ?? null,
    timestamp,
    direction,
    phone: maskPhone(normalizedPhone ?? null),
    document: maskDocument(document),
  });

  // Resolve ou provisiona a instância de WhatsApp.
  let instance: WhatsAppInstanceRecord | null = preloadedInstance ?? null;

  if (resolvedBrokerId) {
    const brokerLookupWhere: Prisma.WhatsAppInstanceWhereInput = { brokerId: resolvedBrokerId };
    if (tenantIdForBrokerLookup) brokerLookupWhere.tenantId = tenantIdForBrokerLookup;
    if (!instance) instance = await prisma.whatsAppInstance.findFirst({ where: brokerLookupWhere });
  }

  if (!instance) instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId as string } });

  if (!instance) {
    const tenantIdentifiersForAutoProvision = resolveTenantIdentifiersFromMetadata(metadataRecord);
    const autoProvisionResult = await attemptAutoProvisionWhatsAppInstance({ instanceId, metadata: metadataRecord, requestId });

    if (autoProvisionResult) {
      instance = autoProvisionResult.instance;
      metadataTenantId = instance?.tenantId ?? metadataTenantId;

      if (instance?.tenantId) {
        (metadataRecord as any).tenantId = instance.tenantId;
        (metadataTenantRecord as any)['id'] = instance.tenantId;
        (metadataTenantRecord as any)['tenantId'] = instance.tenantId;
        (metadataRecord as any).tenant = metadataTenantRecord;
      }

      if (!(metadataRecord as any).brokerId) (metadataRecord as any).brokerId = autoProvisionResult.brokerId;

      if (metadataBroker) {
        if (!(metadataBroker as any).id || (metadataBroker as any).id !== autoProvisionResult.brokerId) {
          (metadataBroker as any).id = autoProvisionResult.brokerId;
        }
      } else {
        (metadataRecord as any).broker = { direction, instanceId, id: autoProvisionResult.brokerId };
      }

      const logContext = {
        requestId,
        instanceId,
        tenantId: instance?.tenantId ?? null,
        tenantIdentifiers: tenantIdentifiersForAutoProvision,
        brokerId: autoProvisionResult.brokerId,
      };

      if (autoProvisionResult.wasCreated) {
        logger.info('🎯 LeadEngine • WhatsApp :: 🆕 Instância autoprov criada durante ingestão padrão', logContext);
      } else {
        logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Instância autoprov reutilizada durante ingestão padrão', logContext);
      }
    } else {
      logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Autoprovisionamento não realizado durante ingestão padrão', {
        requestId, instanceId, tenantIdentifiers: tenantIdentifiersForAutoProvision,
      });
    }
  }

  event.metadata = metadataRecord;

  if (!instance) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 🔍 Instância não encontrada — mensagem inbound estacionada', {
      requestId, instanceId, messageId: (message as any).id ?? null,
    });
    return false;
  }

  const tenantId = instance.tenantId;

  // Busca campanhas ativas; se inexistentes, provisiona fallback.
  // Otimização: usa cache para evitar queries repetidas ao banco
  const cacheKey = `${tenantId}:${instanceId}`;
  const campaigns = await campaignCache.getOrSet(cacheKey, async () => {
    return prisma.campaign.findMany({
      where: { tenantId, whatsappInstanceId: instanceId as string, status: 'active' },
      select: {
        id: true,
        name: true,
        status: true,
        whatsappInstanceId: true,
        tenantId: true,
      },
    });
  });

  if (!campaigns.length) {
    const fallbackCampaign = await provisionFallbackCampaignForInstance(tenantId, instanceId as string);
    if (fallbackCampaign) {
      campaigns.push(fallbackCampaign);
      logger.warn('🎯 LeadEngine • WhatsApp :: 💤 Nenhuma campanha ativa — fallback provisionado', {
        requestId, tenantId, instanceId, fallbackCampaignId: fallbackCampaign.id, messageId: (message as any).id ?? null,
      });
    } else {
      logger.warn('🎯 LeadEngine • WhatsApp :: 💤 Nenhuma campanha ativa para a instância — seguindo mesmo assim', {
        requestId, tenantId, instanceId, messageId: (message as any).id ?? null,
      });
    }
  }

  const leadName = resolvedName ?? 'Contato WhatsApp';
  const registrations = uniqueStringList((contact as any).registrations || null);
  const leadIdBase = (message as any).id || `${instanceId}:${normalizedPhone ?? document}:${timestamp ?? now}`;

  const queueResolution = await ensureInboundQueueForInboundMessage({
    tenantId, requestId: requestId ?? null, instanceId: instanceId ?? null,
  });

  if (!queueResolution.queueId) {
    if (queueResolution.error) {
      logger.warn('🎯 LeadEngine • WhatsApp :: 🧱 Mensagem estacionada por ausência de fila padrão', {
        requestId, tenantId, instanceId, reason: queueResolution.error.reason, recoverable: queueResolution.error.recoverable,
      });
    }
    return false;
  }

  const queueId = queueResolution.queueId;

  // Garante o contato e recupera registro completo para associar ao ticket.
  const contactRecord = await ensureContact(tenantId, {
    phone: normalizedPhone,
    name: leadName,
    document,
    registrations,
    timestamp,
    avatar: resolvedAvatar ?? null,
  });

  const ticketMetadata: Record<string, unknown> = {
    source: 'WHATSAPP',
    instanceId,
    campaignIds: campaigns.map((c) => c.id),
    pipelineStep: 'follow-up',
  };

  const ticketSubject =
    contactRecord.displayName || contactRecord.fullName || contactRecord.primaryPhone || 'Contato WhatsApp';

  const ticketId = await ensureTicketForContact(tenantId, contactRecord.id, queueId, ticketSubject, ticketMetadata);
  if (!ticketId) {
    logger.error('🎯 LeadEngine • WhatsApp :: 🚧 Não consegui garantir o ticket para a mensagem inbound', {
      requestId, tenantId, instanceId, messageId: (message as any).id ?? null,
    });
    return false;
  }

  const normalizedMessage = normalizeInboundMessage(message as InboundMessageDetails);
  const messageKeyRecord =
    message && typeof message === 'object' && 'key' in message && (message as any).key && typeof (message as any).key === 'object'
      ? ((message as any).key as { id?: string | null })
      : null;

  const messageExternalId =
    readString(externalId) ??
    readString((normalizedMessage as any).id) ??
    readString((message as InboundMessageDetails).id) ??
    readString(messageKeyRecord?.id) ??
    (event as any).id;

  if (messageExternalId && !(metadataRecord as any).externalId) (metadataRecord as any).externalId = messageExternalId;

  // Atualiza broker metadata com messageExternalId.
  const metadataBrokerRecord =
    (metadataRecord as any).broker && typeof (metadataRecord as any).broker === 'object'
      ? ((metadataRecord as any).broker as Record<string, unknown>)
      : null;
  if (metadataBrokerRecord) {
    if (messageExternalId && !(metadataBrokerRecord as any).messageId) (metadataBrokerRecord as any).messageId = messageExternalId;
    (metadataBrokerRecord as any).direction = direction;
    (metadataBrokerRecord as any).instanceId = (metadataBrokerRecord as any).instanceId ?? instanceId;
  } else if (messageExternalId) {
    (metadataRecord as any).broker = { direction, instanceId, messageId: messageExternalId };
  }

  const brokerTimestamp = (normalizedMessage as any).brokerMessageTimestamp;
  const normalizedTimestamp = (() => {
    if (typeof brokerTimestamp === 'number') return brokerTimestamp > 1_000_000_000_000 ? brokerTimestamp : brokerTimestamp * 1000;
    if (timestamp) {
      const parsed = Date.parse(timestamp as any);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  })();

  // Deduplica mensagens inbound por externalId ou id normalizado.
  const dedupeKeyMessage = `${tenantId}:${messageExternalId ?? (normalizedMessage as any).id}`;
  if (direction === 'INBOUND' && (await shouldSkipByDedupe(dedupeKeyMessage, now))) {
    logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Mensagem ignorada (janela de dedupe em ação)', {
      requestId, tenantId, ticketId, brokerMessageId: (normalizedMessage as any).id, dedupeKey: dedupeKeyMessage,
    });
    return true;
  }

  // Variáveis auxiliares para download de mídia.
  let downloadedMediaSuccessfully = false;
  let signedMediaUrlExpiresIn: number | null = null;
  let pendingMediaJobDetails:
    | { directPath: string | null; mediaKey: string | null; mediaType: NormalizedMessageType | null; fileName: string | null; mimeType: string | null; size: number | null }
    | null = null;

  const shouldAttemptMediaDownload =
    MEDIA_MESSAGE_TYPES.has((normalizedMessage as any).type) &&
    !isHttpUrl((normalizedMessage as any).mediaUrl ?? undefined);

  if (shouldAttemptMediaDownload) {
    const mediaDetails = extractMediaDownloadDetails(normalizedMessage, metadataRecord);
    const hasDownloadMetadata = Boolean(mediaDetails.directPath || mediaDetails.mediaKey);

    let downloadResult: Awaited<ReturnType<typeof downloadViaBaileys>> | Awaited<ReturnType<typeof downloadViaBroker>> | null = null;

    // Otimização: download com timeout curto para não bloquear processamento
    try {
      downloadResult = await Promise.race([
        downloadViaBaileys(mediaDetails.raw, mediaDetails.rawKey ?? undefined),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)), // Timeout de 5s
      ]);
      
      if (!downloadResult) {
        logger.debug('🎯 LeadEngine • WhatsApp :: ⏱️ Download de mídia via Baileys timeout - será processado em background', {
          requestId, tenantId, instanceId, messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
        });
      }
    } catch (error) {
      logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao baixar mídia inbound diretamente via Baileys', {
        error: mapErrorForLog(error), requestId, tenantId, instanceId, brokerId: resolvedBrokerId ?? null,
        messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
        mediaType: (normalizedMessage as any).type,
      });
    }

    if (!downloadResult) {
      if (!hasDownloadMetadata) {
        logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Metadados insuficientes para download de mídia inbound', {
          requestId, tenantId, instanceId, brokerId: resolvedBrokerId ?? null,
          messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
          mediaType: (normalizedMessage as any).type,
        });
      } else {
        logger.info('🎯 LeadEngine • WhatsApp :: ⬇️ Baixando mídia inbound a partir do broker', {
          requestId, tenantId, instanceId, brokerId: resolvedBrokerId ?? null,
          messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
          mediaType: (normalizedMessage as any).type,
          hasDirectPath: Boolean(mediaDetails.directPath), hasMediaKey: Boolean(mediaDetails.mediaKey),
        });

        // Otimização: download com timeout curto para não bloquear processamento
        try {
          downloadResult = await Promise.race([
            downloadViaBroker({
              brokerId: resolvedBrokerId ?? null,
              instanceId: instanceId as string,
              tenantId,
              mediaKey: mediaDetails.mediaKey,
              directPath: mediaDetails.directPath,
              messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
              mediaType: (normalizedMessage as any).type,
            }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)), // Timeout de 8s
          ]);
          
          if (!downloadResult) {
            logger.debug('🎯 LeadEngine • WhatsApp :: ⏱️ Download de mídia via broker timeout - será processado em background', {
              requestId, tenantId, instanceId, messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
            });
          }
        } catch (error) {
          logger.error('🎯 LeadEngine • WhatsApp :: ❌ Falha ao baixar mídia inbound via broker', {
            error: mapErrorForLog(error), requestId, tenantId, instanceId, brokerId: resolvedBrokerId ?? null,
            messageId: messageExternalId ?? (normalizedMessage as any).id ?? null, mediaType: (normalizedMessage as any).type,
          });
        }
      }

      if (!downloadedMediaSuccessfully && hasDownloadMetadata) {
        pendingMediaJobDetails = {
          directPath: mediaDetails.directPath,
          mediaKey: mediaDetails.mediaKey,
          mediaType: (normalizedMessage as any).type,
          fileName: mediaDetails.fileName,
          mimeType: mediaDetails.mimeType,
          size: mediaDetails.size,
        };
        (metadataRecord as any)['media_pending'] = true;
      }
    }

    if (downloadResult && downloadResult.buffer.length > 0) {
      const saveInput: Parameters<typeof saveWhatsAppMedia>[0] = {
        buffer: downloadResult.buffer,
        tenantId,
        instanceId: instanceIdentifier as string,
        chatId,
        messageId: externalId ?? (normalizedMessage as any).id ?? null,
      };

      if (mediaDetails.fileName) saveInput.originalName = mediaDetails.fileName;

      const mimeCandidate =
        (normalizedMessage as any).mimetype ??
        mediaDetails.mimeType ??
        downloadResult.mimeType ??
        null;

      if (mimeCandidate) saveInput.mimeType = mimeCandidate;

      const descriptor = await saveWhatsAppMedia(saveInput);
      signedMediaUrlExpiresIn = descriptor.expiresInSeconds;

      const resolvedMimeType =
        (normalizedMessage as any).mimetype ??
        mediaDetails.mimeType ??
        downloadResult.mimeType ??
        saveInput.mimeType ??
        null;
      if (!(normalizedMessage as any).mimetype && resolvedMimeType) {
        (normalizedMessage as any).mimetype = resolvedMimeType;
      }

      const resolvedSize =
        (normalizedMessage as any).fileSize ??
        mediaDetails.size ??
        downloadResult.size ??
        downloadResult.buffer.length;
      if (!(normalizedMessage as any).fileSize && resolvedSize !== null) {
        (normalizedMessage as any).fileSize = resolvedSize;
      }

      const resolvedFileName =
        mediaDetails.fileName ?? downloadResult.fileName ?? saveInput.originalName ?? null;

      (normalizedMessage as any).mediaUrl = descriptor.mediaUrl;
      downloadedMediaSuccessfully = true;

      const metadataMedia = toRecord((metadataRecord as any).media);
      (metadataMedia as any).url = descriptor.mediaUrl;
      (metadataMedia as any).urlExpiresInSeconds = descriptor.expiresInSeconds;
      if ((normalizedMessage as any).caption) (metadataMedia as any).caption = (normalizedMessage as any).caption;
      if ((normalizedMessage as any).mimetype) (metadataMedia as any).mimetype = (normalizedMessage as any).mimetype;
      if ((normalizedMessage as any).fileSize !== null && (normalizedMessage as any).fileSize !== undefined) {
        (metadataMedia as any).size = (normalizedMessage as any).fileSize;
      }
      if (resolvedFileName) (metadataMedia as any).fileName = resolvedFileName;

      (metadataRecord as any).media = metadataMedia;
      if ('media_pending' in metadataRecord) delete (metadataRecord as Record<string, unknown>).media_pending;
      pendingMediaJobDetails = null;

      logger.info('🎯 LeadEngine • WhatsApp :: ✅ Mídia inbound baixada e armazenada localmente', {
        requestId, tenantId, instanceId, brokerId: resolvedBrokerId ?? null,
        messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
        mediaType: (normalizedMessage as any).type,
        mediaUrl: descriptor.mediaUrl,
        fileName: resolvedFileName,
        size: (normalizedMessage as any).fileSize ?? null,
      });
    } else if (downloadResult) {
      logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Download de mídia inbound retornou payload vazio', {
        requestId, tenantId, instanceId, brokerId: resolvedBrokerId ?? null,
        messageId: messageExternalId ?? (normalizedMessage as any).id ?? null,
        mediaType: (normalizedMessage as any).type,
      });
    }
  }

  const currentMediaUrl = (normalizedMessage as any).mediaUrl ?? null;
  if (!downloadedMediaSuccessfully && currentMediaUrl && !isHttpUrl(currentMediaUrl)) {
    (normalizedMessage as any).mediaUrl = null;
    const metadataMedia = (metadataRecord as any).media;
    if (metadataMedia && typeof metadataMedia === 'object' && !Array.isArray(metadataMedia)) {
      delete (metadataMedia as Record<string, unknown>)['url'];
      if (Object.keys(metadataMedia as Record<string, unknown>).length === 0) {
        delete (metadataRecord as any).media;
      }
    }
  }

  let persistedMessage: Awaited<ReturnType<typeof sendMessageService>> | null = null;

  const timelineMessageType = (() => {
    switch ((normalizedMessage as any).type) {
      case 'IMAGE':
      case 'VIDEO':
      case 'AUDIO':
      case 'DOCUMENT':
      case 'LOCATION':
      case 'CONTACT':
      case 'TEMPLATE':
        return (normalizedMessage as any).type;
      case 'TEXT':
      default:
        return 'TEXT';
    }
  })();

  try {
    const resolvedMediaUrl =
      downloadedMediaSuccessfully || isHttpUrl((normalizedMessage as any).mediaUrl ?? undefined)
        ? (normalizedMessage as any).mediaUrl
        : null;

    const messageMetadata: Record<string, unknown> = {
      broker: {
        messageId: messageExternalId ?? (normalizedMessage as any).id,
        clientMessageId: (normalizedMessage as any).clientMessageId,
        conversationId: (normalizedMessage as any).conversationId,
        instanceId,
        campaignIds: campaigns.map((c) => c.id),
      },
      externalId: messageExternalId ?? undefined,
      media: resolvedMediaUrl
        ? {
            url: resolvedMediaUrl,
            mimetype: (normalizedMessage as any).mimetype,
            caption: (normalizedMessage as any).caption,
            size: (normalizedMessage as any).fileSize,
            urlExpiresInSeconds: signedMediaUrlExpiresIn ?? undefined,
          }
        : undefined,
      location:
        (normalizedMessage as any).latitude || (normalizedMessage as any).longitude
          ? {
              latitude: (normalizedMessage as any).latitude,
              longitude: (normalizedMessage as any).longitude,
              name: (normalizedMessage as any).locationName,
            }
          : undefined,
      contacts: (normalizedMessage as any).contacts ?? undefined,
      raw: (normalizedMessage as any).raw,
      eventMetadata: event.metadata ?? {},
      receivedAt: (normalizedMessage as any).receivedAt,
      brokerMessageTimestamp: (normalizedMessage as any).brokerMessageTimestamp,
      normalizedTimestamp,
    };

    if (pendingMediaJobDetails) (messageMetadata as any).media_pending = true;

    persistedMessage = await sendMessageService(tenantId, undefined, {
      ticketId,
      content: (normalizedMessage as any).text ?? '[Mensagem]',
      type: timelineMessageType,
      direction,
      externalId: messageExternalId ?? undefined,
      mediaUrl: resolvedMediaUrl ?? undefined,
      metadata: messageMetadata,
    });
  } catch (error) {
    logger.error('🎯 LeadEngine • WhatsApp :: 💾 Falha ao salvar a mensagem inbound na timeline do ticket', {
      error: mapErrorForLog(error), requestId, tenantId, ticketId, messageId: (message as any).id ?? null,
    });
  }

  if (persistedMessage) {
    await registerDedupeKey(dedupeKeyMessage, now, DEFAULT_DEDUPE_TTL_MS);

    const providerMessageId = (normalizedMessage as any).id ?? null;

    if (pendingMediaJobDetails) {
      try {
        await enqueueInboundMediaJob({
          tenantId,
          messageId: persistedMessage.id,
          messageExternalId: messageExternalId ?? providerMessageId,
          instanceId: instanceId as string,
          brokerId: resolvedBrokerId ?? null,
          mediaType: pendingMediaJobDetails.mediaType ?? null,
          mediaKey: pendingMediaJobDetails.mediaKey,
          directPath: pendingMediaJobDetails.directPath,
          metadata: {
            requestId: requestId ?? null,
            eventId: (event as any).id ?? null,
            fileName: pendingMediaJobDetails.fileName,
            mimeType: pendingMediaJobDetails.mimeType,
            size: pendingMediaJobDetails.size,
          },
        });
      } catch (error) {
        logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao enfileirar job de mídia inbound', {
          error: mapErrorForLog(error), tenantId, ticketId, instanceId, messageId: persistedMessage.id,
        });
      }
    }

    await emitRealtimeUpdatesForInbound({
      tenantId,
      ticketId,
      instanceId: instanceId as string,
      message: persistedMessage,
      providerMessageId,
      emitTicketRealtimeEvents: false,
    });

    let inboundLeadId: string | null = null;

    if (direction === 'INBOUND') {
      try {
        const { lead } = await upsertLeadFromInbound({
          tenantId,
          contactId: contactRecord.id,
          ticketId,
          instanceId: instanceId as string,
          providerMessageId,
          message: persistedMessage,
        });
        inboundLeadId = lead.id;
      } catch (error) {
        logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao sincronizar lead inbound', {
          error: mapErrorForLog(error), requestId, tenantId, ticketId, instanceId, contactId: contactRecord.id,
          messageId: persistedMessage.id, providerMessageId,
        });
      }
    }

    inboundMessagesProcessedCounter.inc({
      origin: 'legacy',
      tenantId,
      instanceId: (instanceId as string) ?? 'unknown',
    });

    logger.info('🎯 LeadEngine • WhatsApp :: ✅ Mensagem inbound processada', {
      requestId, tenantId, ticketId, contactId: contactRecord.id, instanceId, messageId: persistedMessage.id,
      providerMessageId, leadId: inboundLeadId,
    });
  }

  // Alocação de leads para campanhas/instância.
  const allocationTargets: Array<{
    campaign: (typeof campaigns)[number] | null;
    target: { campaignId?: string; instanceId?: string };
  }> =
    campaigns.length
      ? campaigns.map((campaign) => ({ campaign, target: { campaignId: campaign.id } }))
      : instanceId
      ? [{ campaign: null, target: { instanceId: instanceId as string } }]
      : [];

  if (!campaigns.length && !instanceId) {
    logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Instância sem identificador para alocação fallback', {
      requestId, tenantId, instanceId, messageId: (message as any).id ?? null,
    });
  }

  for (const { campaign, target } of allocationTargets) {
    const campaignId = campaign?.id ?? null;
    const agreementId = campaign?.agreementId || 'unknown';
    const allocationDedupeKey = campaignId
      ? `${tenantId}:${campaignId}:${document || normalizedPhone || leadIdBase}`
      : `${tenantId}:${instanceId}:${document || normalizedPhone || leadIdBase}`;

    if (campaignId && (await shouldSkipByDedupe(allocationDedupeKey, now))) {
      logger.info('🎯 LeadEngine • WhatsApp :: ⏱️ Mensagem já tratada nas últimas 24h — evitando duplicidade', {
        requestId, tenantId, campaignId, instanceId, messageId: (message as any).id ?? null, phone: maskPhone(normalizedPhone ?? null),
        dedupeKey: allocationDedupeKey,
      });
      continue;
    }

    const brokerLead: BrokerLeadRecord & { raw: Record<string, unknown> } = {
      id: campaignId ? `${leadIdBase}:${campaignId}` : `${leadIdBase}:instance:${instanceId}`,
      fullName: leadName,
      document,
      registrations,
      agreementId,
      tags: ['inbound-whatsapp'],
      raw: {
        from: contact,
        message,
        metadata: event.metadata ?? {},
        receivedAt: timestamp ?? new Date(now).toISOString(),
      },
    };
    if (normalizedPhone) brokerLead.phone = normalizedPhone;

    try {
      const { newlyAllocated, summary } = await addAllocations(tenantId, target, [brokerLead]);
      await registerDedupeKey(allocationDedupeKey, now, DEFAULT_DEDUPE_TTL_MS);

      if (newlyAllocated.length > 0) {
        const allocation = newlyAllocated[0]!;
        logger.info('🎯 LeadEngine • WhatsApp :: 🎯 Lead inbound alocado com sucesso', {
          tenantId, campaignId: allocation.campaignId ?? campaignId, instanceId, allocationId: allocation.allocationId,
          phone: maskPhone(normalizedPhone ?? null), leadId: allocation.leadId,
        });

        const realtimePayload = {
          tenantId,
          campaignId: allocation.campaignId ?? null,
          agreementId: allocation.agreementId ?? null,
          instanceId: allocation.instanceId,
          allocation,
          summary,
        };

        emitToTenant(tenantId, 'leadAllocations.new', realtimePayload);
        if (allocation.agreementId && allocation.agreementId !== 'unknown') {
          emitToAgreement(allocation.agreementId, 'leadAllocations.new', realtimePayload);
        }
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        logger.debug('🎯 LeadEngine • WhatsApp :: ⛔ Lead inbound já alocado recentemente — ignorando duplicidade', {
          tenantId, campaignId: campaignId ?? undefined, instanceId, phone: maskPhone(normalizedPhone ?? null),
        });
        await registerDedupeKey(allocationDedupeKey, now, DEFAULT_DEDUPE_TTL_MS);
        continue;
      }

      logger.error('🎯 LeadEngine • WhatsApp :: 🚨 Falha ao alocar lead inbound', {
        error: mapErrorForLog(error), tenantId, campaignId: campaignId ?? undefined, instanceId,
        phone: maskPhone(normalizedPhone ?? null),
      });
    }
  }

  const totalDuration = perfTracker.end('total');
  
  // Registra métrica de latência
  whatsappInboundMetrics.observeLatency({
    origin: 'webhook',
    tenantId: tenantId ?? 'unknown',
    instanceId: (instanceId as string) ?? 'unknown',
  }, totalDuration);

  // Log de performance (apenas em debug)
  if (totalDuration > 1000) {
    perfTracker.logSummary('info');
  }

  return !!persistedMessage;
};

/* ===========================================================================================
 * Test hooks e exports
 * ===========================================================================================
 */

export const __testing = {
  ensureTicketForContact,
  upsertLeadFromInbound,
  emitRealtimeUpdatesForInbound,
  processStandardInboundEvent,
};

// Exporta somente os tipos de envelope, pois o tipo InboundWhatsAppEvent
// foi revisado e incorporado neste arquivo. Se precisar modificar o tipo,
// edite também ./types.ts para refletir instanceId: string | null.
export type { InboundWhatsAppEnvelope, InboundWhatsAppEnvelopeMessage } from './types';