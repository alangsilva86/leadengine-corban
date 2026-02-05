import { getAiConfig } from '@ticketz/storage';
import { logger } from '../config/logger';
import { getAiRoutingPreferences } from '../config/ai-route';
import { isAiEnabled as isAiEnabledImported, resolveDefaultAiMode } from '../config/ai';
import { generateAiReply } from './ai/generate-reply';
import { sendMessage } from './ticket-service';
import { prisma } from '../lib/prisma';

// ---- AI Auto-Reply runtime guards & helpers ----
const AI_TIMEOUT_MS = Number(process.env.AI_AUTO_REPLY_TIMEOUT_MS ?? '15000');

function safePreview(input?: string, max = 120) {
  if (!input) return '';
  const s = String(input);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return (await Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), ms)),
  ])) as T;
}

/**
 * Serviço responsável por processar respostas automáticas da IA
 * quando uma mensagem inbound é recebida.
 */

interface ProcessAiReplyOptions {
  tenantId: string;
  ticketId: string;
  messageId: string;
  messageContent: string;
  contactId: string;
  queueId?: string | null;
}

/**
 * Normaliza feature-flag de IA: funciona se exportada como função ou boolean.
 */
function resolveAiEnabled(): boolean {
  try {
    const resolved = isAiEnabledImported as unknown;
    if (typeof resolved === 'function') {
      return Boolean((resolved as () => unknown)());
    }
    return Boolean(resolved);
  } catch (e) {
    logger.warn('AI AUTO-REPLY :: isAiEnabled falhou, assumindo desabilitado', {
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

/**
 * Evita duplicidade: já respondemos automaticamente a este messageId?
 */
async function alreadyRepliedToMessage(
  tenantId: string,
  ticketId: string,
  messageId: string
): Promise<boolean> {
  try {
    // Busca uma resposta OUTBOUND com metadados que referenciem o disparador
    const found = await prisma.message.findFirst({
      where: {
        tenantId,
        ticketId,
        direction: 'OUTBOUND',
        // JSON filter: metadata.triggeredByMessageId == messageId
        metadata: {
          path: ['triggeredByMessageId'],
          equals: messageId,
        } as any, // compatibilidade de tipos JSON
      },
      select: { id: true },
    });
    return Boolean(found);
  } catch (e) {
    logger.warn('AI AUTO-REPLY :: falha ao verificar idempotência, prosseguindo com cautela', {
      error: e instanceof Error ? e.message : String(e),
      tenantId,
      ticketId,
      messageId,
    });
    return false;
  }
}

/**
 * Protege contra loops: não responder mensagens OUTBOUND (ex.: da própria IA)
 */
async function isOutboundMessage(
  tenantId: string,
  ticketId: string,
  messageId: string
): Promise<boolean> {
  try {
    const msg = await prisma.message.findFirst({
      where: { tenantId, ticketId, id: messageId },
      select: { id: true, direction: true },
    });
    return msg?.direction === 'OUTBOUND';
  } catch {
    return false;
  }
}

/**
 * Processa uma mensagem inbound e aciona a IA se necessário
 */
export async function processAiAutoReply(options: ProcessAiReplyOptions): Promise<void> {
  const { tenantId, ticketId, messageId, messageContent, contactId, queueId } = options;
  const fallbackMode = resolveDefaultAiMode();

  logger.debug('AI AUTO-REPLY :: starting', {
    tenantId,
    ticketId,
    messageId,
    messageContentPreview: safePreview(messageContent, 80),
  });

  if (!messageContent || !messageContent.trim()) {
    logger.debug('AI AUTO-REPLY :: skipped (empty content)', { tenantId, ticketId, messageId });
    return;
  }

  const { mode: routeMode, serverAutoReplyEnabled, forceServerAutoReply } = getAiRoutingPreferences();
  logger.debug('AI AUTO-REPLY :: route mode check', {
    routeMode,
    serverAutoReplyEnabled,
    forceServerAutoReply,
  });
  if (!serverAutoReplyEnabled) {
    logger.debug('AI AUTO-REPLY :: skipped (server auto-reply disabled)', {
      tenantId,
      ticketId,
      messageId,
      aiRouteMode: routeMode,
    });
    return;
  }

  if (routeMode === 'front') {
    logger.debug('AI AUTO-REPLY :: server override active while routeMode=front', {
      tenantId,
      ticketId,
      messageId,
    });
  }

  try {
    const aiEnabled = resolveAiEnabled();

    logger.debug('AI AUTO-REPLY :: DEBUG isAiEnabled', {
      aiEnabled,
      typeOfIsAiEnabled: typeof isAiEnabledImported,
    });

    // Verificar se a IA está habilitada globalmente
    if (!aiEnabled) {
      logger.debug('AI AUTO-REPLY :: skipped (AI globally disabled)', {
        tenantId,
        ticketId,
      });
      return;
    }

    // Não responder a mensagens OUTBOUND (prevenção de eco/loop)
    if (await isOutboundMessage(tenantId, ticketId, messageId)) {
      logger.debug('AI AUTO-REPLY :: skipped (message is outbound)', {
        tenantId,
        ticketId,
        messageId,
      });
      return;
    }

    // Idempotência: não responder duas vezes ao mesmo gatilho
    if (await alreadyRepliedToMessage(tenantId, ticketId, messageId)) {
      logger.debug('AI AUTO-REPLY :: skipped (already replied)', {
        tenantId,
        ticketId,
        messageId,
      });
      return;
    }

    // Buscar configuração de IA para o tenant/queue
    let aiConfig: Awaited<ReturnType<typeof getAiConfig>> | null = null;
    try {
      aiConfig = await getAiConfig(tenantId, queueId ?? null);
    } catch (e) {
      logger.warn('AI AUTO-REPLY :: falha ao obter configuração, usando modo padrão configurado', {
        error: e instanceof Error ? e.message : String(e),
        tenantId,
        ticketId,
        fallbackMode,
      });
    }

    // Verificar o modo de IA configurado
    const aiMode = aiConfig?.defaultMode ?? fallbackMode;
    const normalizedAiMode =
      aiMode === 'IA_AUTO' ? 'IA_AUTO' : aiMode === 'HUMANO' ? 'HUMANO' : 'COPILOTO';

    let effectiveAiMode = normalizedAiMode;
    if (effectiveAiMode !== 'HUMANO' && effectiveAiMode !== 'IA_AUTO' && forceServerAutoReply) {
      logger.info('🤖 AI AUTO-REPLY :: ✅ override front-mode → IA_AUTO (assistência permitida)', {
        tenantId,
        ticketId,
        originalMode: normalizedAiMode,
      });
      effectiveAiMode = 'IA_AUTO';
    }

    logger.debug('AI AUTO-REPLY :: mode resolved', {
      tenantId,
      ticketId,
      aiMode: effectiveAiMode,
      aiConfigExists: Boolean(aiConfig),
    });

    // Normaliza ator/labels conforme modo atual
    const aiActor =
      effectiveAiMode === 'IA_AUTO'
        ? { origin: 'ai_auto', authorType: 'ai_auto' as const, aiMode: 'IA_AUTO' as const, label: 'IA (auto)' }
        : { origin: 'copilot', authorType: 'ai_suggest' as const, aiMode: 'COPILOTO' as const, label: 'Copiloto' };

    // Apenas responder automaticamente se estiver em modo IA_AUTO
    if (effectiveAiMode !== 'IA_AUTO') {
      logger.debug('AI AUTO-REPLY :: skipped (mode is not IA_AUTO)', {
        tenantId,
        ticketId,
        currentMode: effectiveAiMode,
      });
      return;
    }

    // Buscar histórico de mensagens do ticket (limite e seleção enxutos)
    const messages = await prisma.message.findMany({
      where: { tenantId, ticketId },
      orderBy: { createdAt: 'desc' },
      take: 12, // ligeiro aumento p/ contexto com limite
      select: {
        id: true,
        content: true,
        direction: true,
        createdAt: true,
        metadata: true,
      },
    });

    // Construir contexto de mensagens para a IA (cap conteúdo para reduzir tokens)
    const MAX_CONTENT = 1500; // por mensagem
    const conversationMessages = messages
      .reverse()
      .filter((msg) => Boolean(msg.content))
      .map((msg) => ({
        role: msg.direction === 'OUTBOUND' ? ('assistant' as const) : ('user' as const),
        content: (msg.content as string).slice(0, MAX_CONTENT),
      }));

    // Adicionar mensagem atual se não estiver no histórico
    if (!messages.find((m) => m.id === messageId)) {
      conversationMessages.push({ role: 'user', content: messageContent.slice(0, MAX_CONTENT) });
    }

    if (conversationMessages.length === 0) {
      logger.info('AI auto-reply skipped: no messages to process', { tenantId, ticketId });
      return;
    }

    logger.debug('AI AUTO-REPLY :: CALLING generateAiReply', {
      tenantId,
      ticketId,
      queueId: queueId ?? null,
      timeoutMs: AI_TIMEOUT_MS,
      lastUserPreview: safePreview(conversationMessages[conversationMessages.length - 1]?.content as string),
    });

    let aiResponse;
    try {
      aiResponse = await withTimeout(
        generateAiReply({
          tenantId,
          conversationId: ticketId,
          messages: conversationMessages,
          queueId: queueId ?? null,
          metadata: {
            autoReply: true,
            triggeredByMessageId: messageId,
            aiMode: aiActor.aiMode,
          },
        }),
        AI_TIMEOUT_MS
      );
    } catch (err: any) {
      logger.error('🤖 AI AUTO-REPLY :: 🛑 FALHA ao gerar resposta', {
        tenantId,
        ticketId,
        errorName: err?.name,
        errorMessage: err?.message,
      });
      return;
    }

    logger.debug('AI AUTO-REPLY :: generateAiReply OK', {
      tenantId,
      ticketId,
      status: aiResponse?.status,
      model: aiResponse?.model,
      replyPreview: safePreview(aiResponse?.message ?? ''),
    });

    if (aiResponse.status === 'success' || aiResponse.status === 'stubbed') {
      const reply = (aiResponse.message || '').trim();
      if (!reply) {
        logger.warn('AI auto-reply: resposta vazia, nada será enviado', { tenantId, ticketId });
        return;
      }

      logger.info('🤖 AI AUTO-REPLY :: 📤 ENVIANDO resposta', {
        tenantId,
        ticketId,
        replyLength: reply.length,
        model: aiResponse.model,
      });

      try {
        await sendMessage(
          tenantId,
          undefined, // userId (sistema automático)
          {
            ticketId,
            content: reply,
            direction: 'OUTBOUND',
            status: 'PENDING',
            metadata: {
              aiGenerated: true,
              aiModel: aiResponse.model,
              aiMode: aiActor.aiMode, // 'IA_AUTO' | 'COPILOTO'
              origin: aiActor.origin, // 'ai_auto' | 'copilot'
              authorType: aiActor.authorType, // 'ai_auto' | 'ai_suggest'
              usage: aiResponse.usage,
              triggeredByMessageId: messageId,
            },
          }
        );
        logger.info('🤖 AI AUTO-REPLY :: ✅ RESPOSTA ENVIADA COM SUCESSO', {
          tenantId,
          ticketId,
          model: aiResponse.model,
          aiMode: aiActor.aiMode,
          origin: aiActor.origin,
          authorType: aiActor.authorType,
        });
      } catch (sendErr: any) {
        logger.error('🤖 AI AUTO-REPLY :: 📩 ERRO NO ENVIO', {
          tenantId,
          ticketId,
          errorName: sendErr?.name,
          errorMessage: sendErr?.message,
          status: sendErr?.response?.status,
        });
        return;
      }
    } else {
      logger.warn('AI auto-reply: failed to generate response', {
        tenantId,
        ticketId,
        status: aiResponse.status,
        model: (aiResponse as any)?.model,
        replyPreview: safePreview((aiResponse as any)?.message ?? ''),
      });
    }
  } catch (error: any) {
    logger.error('🤖 AI AUTO-REPLY :: ❌ ERRO ao processar', {
      error: error instanceof Error ? error.message : String(error),
      name: error?.name,
      cause: (error as any)?.cause ? String((error as any).cause) : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      tenantId,
      ticketId,
      messageId,
    });
  }
}

/**
 * Verifica se o ticket está configurado para resposta automática da IA
 */
export async function shouldTriggerAiAutoReply(
  tenantId: string,
  ticketId: string,
  queueId?: string | null
): Promise<boolean> {
  const { serverAutoReplyEnabled } = getAiRoutingPreferences();
  if (!serverAutoReplyEnabled) return false;
  if (!resolveAiEnabled()) return false;

  try {
    const aiConfig = await getAiConfig(tenantId, queueId ?? null);
    const fallbackMode = resolveDefaultAiMode();
    return (aiConfig?.defaultMode ?? fallbackMode) === 'IA_AUTO';
  } catch (error) {
    logger.error('Failed to check AI auto-reply config', {
      error: error instanceof Error ? error.message : String(error),
      tenantId,
      ticketId,
      queueId,
    });
    return false;
  }
}
