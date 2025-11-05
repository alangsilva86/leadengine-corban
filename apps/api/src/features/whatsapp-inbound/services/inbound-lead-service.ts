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

import { logger } from '../../../config/logger';
import { inboundMessagesProcessedCounter } from '../../../lib/metrics';
import { emitWhatsAppDebugPhase } from '../../debug/services/whatsapp-debug-emitter';
import {
  DEFAULT_DEDUPE_TTL_MS,
  DEFAULT_TENANT_ID,
} from './constants';
import { registerDedupeKey, shouldSkipByDedupe } from './dedupe';
import { readString } from './identifiers';
import { normalizePollUpdate, resolveMessageType } from './poll-update-normalizer';
import { derivePayloadSegments, toRecord } from './inbound-lead/helpers';
import {
  type InboundMessageDetails,
  type InboundWhatsAppEnvelope,
  type InboundWhatsAppEnvelopeMessage,
  type InboundWhatsAppEvent,
} from './types';
import {
  invalidateCampaignCache as invalidateCampaignCacheState,
  resetInboundLeadState,
} from './inbound-lead/state';
import {
  mergeEnvelopeMetadata,
  resolveChatId,
  resolveMessageId,
} from './inbound-lead/envelope-utils';
import {
  processStandardInboundEvent,
  __testing as pipelineTesting,
} from './inbound-lead/pipeline';
import { __testing as ticketTesting } from './inbound-lead/ticket-service';
import { __testing as leadTesting } from './inbound-lead/lead-service';
import { __testing as realtimeTesting } from './inbound-lead/realtime-service';

export const resetInboundLeadServiceTestState = (): void => {
  resetInboundLeadState();
};

export const invalidateCampaignCache = (tenantId: string, instanceId: string): void => {
  invalidateCampaignCacheState(tenantId, instanceId);
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

  // Garante que existe payload de mensagem ou metadata antes de prosseguir.
  const { payload: payloadRecord, message: basePayloadMessage, metadata: basePayloadMetadata } = derivePayloadSegments(
    (envelope as any)?.message?.payload
  );
  let payloadMessage: Record<string, unknown> = { ...basePayloadMessage };
  let payloadMetadata: Record<string, unknown> = { ...basePayloadMetadata };

  // Determina tipo de mensagem para identificar enquetes antes de normalizar o payload.
  const msgType = resolveMessageType({
    payload: payloadRecord,
    message: payloadMessage,
    metadata: payloadMetadata,
  });

  const envelopeMetadataRecord = toRecord((envelope as any)?.message?.metadata);
  if (Object.keys(envelopeMetadataRecord).length > 0) {
    payloadMetadata = { ...envelopeMetadataRecord, ...payloadMetadata };
  }

  const hasMessageContent = Object.keys(payloadMessage).length > 0;
  const hasMetadataContent = Object.keys(payloadMetadata).length > 0;

  if (!hasMessageContent && !hasMetadataContent) {
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
  const metaIn = { ...payloadMetadata };
  const chatId = resolveChatId(envelope);
  const externalId = resolveMessageId(envelope) ?? randomUUID();
  const instanceId = readString((metaIn as any).instanceId) ?? readString((envelope as any).instanceId);
  const tenantId = readString((metaIn as any).tenantId) ?? readString((envelope as any).tenantId) ?? DEFAULT_TENANT_ID;

  // Tratamento especial de voto em enquete: gera envelope normalizado ou sinaliza placeholder.
  const pollNormalization = await normalizePollUpdate({
    envelope,
    segments: { payload: payloadRecord, message: payloadMessage, metadata: payloadMetadata },
    baseMetadata: metaIn,
    chatId,
    externalId,
    messageType: msgType,
  });

  if (pollNormalization.isPollUpdate) {
    if (pollNormalization.placeholder) {
      payloadMetadata = pollNormalization.metadata;
    } else {
      payloadMessage = pollNormalization.message;
      payloadMetadata = pollNormalization.metadata;
    }
  }

  // Pipeline padrão (inclusive para poll_update sem texto).
  const now = Date.now();

  // Constrói metadata consolidada para a mensagem.
  const normalizedPayload = { ...payloadRecord, message: payloadMessage, metadata: payloadMetadata };
  const metadata = mergeEnvelopeMetadata(
    {
      ...(envelope as any),
      message: (envelope as InboundWhatsAppEnvelopeMessage).message,
    } as InboundWhatsAppEnvelopeMessage,
    chatId,
    { payload: normalizedPayload, message: payloadMessage, metadata: payloadMetadata }
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
    payload: { message: payloadMessage, metadata, rawPayload: normalizedPayload },
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
    message: payloadMessage as InboundMessageDetails,
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
 * Test hooks e exports
 * ===========================================================================================
 */

export const __testing = {
  ...pipelineTesting,
  ...ticketTesting,
  ...leadTesting,
  ...realtimeTesting,
};

// Exporta somente os tipos de envelope, pois o tipo InboundWhatsAppEvent
// foi revisado e incorporado neste arquivo. Se precisar modificar o tipo,
// edite também ./types.ts para refletir instanceId: string | null.
export type { InboundWhatsAppEnvelope, InboundWhatsAppEnvelopeMessage } from './types';
