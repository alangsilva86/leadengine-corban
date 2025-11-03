import { getAiConfig } from '@ticketz/storage';
import { logger } from '../config/logger';
import { isAiEnabled } from '../config/ai';
import { generateAiReply } from './ai/generate-reply';
import { sendMessage } from './ticket-service';
import { prisma } from '../lib/prisma';

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
 * Processa uma mensagem inbound e aciona a IA se necessário
 */
export async function processAiAutoReply(options: ProcessAiReplyOptions): Promise<void> {
  const { tenantId, ticketId, messageId, messageContent, contactId, queueId } = options;

  try {
    // Verificar se a IA está habilitada globalmente
    if (!isAiEnabled) {
      logger.debug('AI auto-reply skipped: AI is disabled globally', {
        tenantId,
        ticketId,
      });
      return;
    }

    // Buscar configuração de IA para o tenant/queue
    const aiConfig = await getAiConfig(tenantId, queueId ?? null);
    
    // Verificar o modo de IA configurado
    const aiMode = aiConfig?.defaultMode ?? 'COPILOTO';
    
    logger.debug('AI auto-reply check', {
      tenantId,
      ticketId,
      aiMode,
      aiConfigExists: !!aiConfig,
    });

    // Apenas responder automaticamente se estiver em modo IA_AUTO
    if (aiMode !== 'IA_AUTO') {
      logger.debug('AI auto-reply skipped: mode is not IA_AUTO', {
        tenantId,
        ticketId,
        currentMode: aiMode,
      });
      return;
    }

    // Buscar histórico de mensagens do ticket
    const messages = await prisma.message.findMany({
      where: {
        tenantId,
        ticketId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // Últimas 10 mensagens para contexto
      select: {
        id: true,
        content: true,
        direction: true,
        createdAt: true,
      },
    });

    // Construir contexto de mensagens para a IA
    const conversationMessages = messages
      .reverse()
      .filter((msg) => msg.content) // Filtrar mensagens sem conteúdo
      .map((msg) => ({
        role: msg.direction === 'OUTBOUND' ? ('assistant' as const) : ('user' as const),
        content: msg.content!,
      }));

    // Adicionar mensagem atual se não estiver no histórico
    if (!messages.find((m) => m.id === messageId)) {
      conversationMessages.push({
        role: 'user' as const,
        content: messageContent,
      });
    }

    // Garantir que há pelo menos uma mensagem
    if (conversationMessages.length === 0) {
      logger.warn('AI auto-reply skipped: no messages to process', {
        tenantId,
        ticketId,
      });
      return;
    }

    logger.info('AI auto-reply: generating response', {
      tenantId,
      ticketId,
      messageCount: conversationMessages.length,
    });

    // Gerar resposta da IA
    const aiResponse = await generateAiReply({
      tenantId,
      conversationId: ticketId,
      messages: conversationMessages,
      queueId,
      metadata: {
        autoReply: true,
        triggeredByMessageId: messageId,
      },
    });

    // Se a resposta foi gerada com sucesso, enviar mensagem
    if (aiResponse.status === 'success' || aiResponse.status === 'stubbed') {
      logger.info('AI auto-reply: sending response', {
        tenantId,
        ticketId,
        messageLength: aiResponse.message.length,
        model: aiResponse.model,
      });

      // Enviar mensagem de resposta
      await sendMessage({
        tenantId,
        ticketId,
        contactId,
        content: aiResponse.message,
        direction: 'OUTBOUND',
        status: 'PENDING',
        metadata: {
          aiGenerated: true,
          aiModel: aiResponse.model,
          aiMode: 'auto',
          usage: aiResponse.usage,
        },
      });

      logger.info('AI auto-reply: response sent successfully', {
        tenantId,
        ticketId,
        model: aiResponse.model,
      });
    } else {
      logger.warn('AI auto-reply: failed to generate response', {
        tenantId,
        ticketId,
        status: aiResponse.status,
      });
    }

  } catch (error) {
    logger.error('AI auto-reply: failed to process', {
      error: error instanceof Error ? error.message : String(error),
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
  if (!isAiEnabled) {
    return false;
  }

  try {
    const aiConfig = await getAiConfig(tenantId, queueId ?? null);
    return aiConfig?.defaultMode === 'IA_AUTO';
  } catch (error) {
    logger.error('Failed to check AI auto-reply config', {
      error: error instanceof Error ? error.message : String(error),
      tenantId,
      ticketId,
    });
    return false;
  }
}
