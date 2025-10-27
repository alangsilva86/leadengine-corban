/**
 * Dead Letter Queue (DLQ) para Mensagens com Falha
 * 
 * Sistema para armazenar e gerenciar mensagens que falharam permanentemente,
 * permitindo análise e reprocessamento manual.
 */

import { logger } from '../config/logger';
import { inboundMediaRetryDlqCounter } from './metrics';

export interface FailedMessage {
  id: string;
  tenantId: string;
  instanceId: string | null;
  timestamp: string;
  failureReason: string;
  failureCount: number;
  lastError: string;
  payload: unknown;
  metadata: Record<string, unknown>;
}

/**
 * Store em memória para DLQ (em produção, usar banco de dados)
 * Limitado a 1000 entradas para evitar memory leak
 */
class FailedMessageDLQ {
  private messages = new Map<string, FailedMessage>();
  private readonly maxSize = 1000;

  /**
   * Adiciona uma mensagem à DLQ
   */
  add(message: FailedMessage): void {
    // Se atingiu o tamanho máximo, remove a mais antiga
    if (this.messages.size >= this.maxSize) {
      const firstKey = this.messages.keys().next().value;
      if (firstKey) {
        this.messages.delete(firstKey);
      }
    }

    this.messages.set(message.id, message);

    // Registra métrica
    inboundMediaRetryDlqCounter.inc({
      tenantId: message.tenantId,
      instanceId: message.instanceId ?? 'unknown',
    });

    // Log estruturado para análise
    logger.error('Message sent to DLQ', {
      messageId: message.id,
      tenantId: message.tenantId,
      instanceId: message.instanceId,
      failureReason: message.failureReason,
      failureCount: message.failureCount,
      lastError: message.lastError,
    });
  }

  /**
   * Obtém uma mensagem da DLQ
   */
  get(id: string): FailedMessage | undefined {
    return this.messages.get(id);
  }

  /**
   * Lista todas as mensagens da DLQ
   */
  list(filters?: {
    tenantId?: string;
    instanceId?: string;
    limit?: number;
  }): FailedMessage[] {
    let messages = Array.from(this.messages.values());

    if (filters?.tenantId) {
      messages = messages.filter(m => m.tenantId === filters.tenantId);
    }

    if (filters?.instanceId) {
      messages = messages.filter(m => m.instanceId === filters.instanceId);
    }

    if (filters?.limit) {
      messages = messages.slice(0, filters.limit);
    }

    return messages;
  }

  /**
   * Remove uma mensagem da DLQ (após reprocessamento bem-sucedido)
   */
  remove(id: string): boolean {
    return this.messages.delete(id);
  }

  /**
   * Limpa todas as mensagens da DLQ
   */
  clear(): void {
    this.messages.clear();
    logger.info('DLQ cleared');
  }

  /**
   * Retorna estatísticas da DLQ
   */
  getStats() {
    const messages = Array.from(this.messages.values());
    const byTenant = new Map<string, number>();
    const byReason = new Map<string, number>();

    for (const msg of messages) {
      byTenant.set(msg.tenantId, (byTenant.get(msg.tenantId) ?? 0) + 1);
      byReason.set(msg.failureReason, (byReason.get(msg.failureReason) ?? 0) + 1);
    }

    return {
      total: messages.length,
      maxSize: this.maxSize,
      byTenant: Object.fromEntries(byTenant),
      byReason: Object.fromEntries(byReason),
      oldestTimestamp: messages[0]?.timestamp,
      newestTimestamp: messages[messages.length - 1]?.timestamp,
    };
  }
}

/**
 * Instância global da DLQ
 */
export const failedMessageDLQ = new FailedMessageDLQ();

/**
 * Helper para adicionar mensagem à DLQ com informações contextuais
 */
export function sendToFailedMessageDLQ(
  id: string,
  tenantId: string,
  error: unknown,
  context: {
    instanceId?: string | null;
    failureCount?: number;
    payload?: unknown;
    metadata?: Record<string, unknown>;
  } = {}
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  failedMessageDLQ.add({
    id,
    tenantId,
    instanceId: context.instanceId ?? null,
    timestamp: new Date().toISOString(),
    failureReason: errorMessage,
    failureCount: context.failureCount ?? 1,
    lastError: errorStack ?? errorMessage,
    payload: context.payload ?? {},
    metadata: context.metadata ?? {},
  });
}

/**
 * Helper para verificar se uma mensagem deve ser enviada à DLQ
 * baseado no número de tentativas
 */
export function shouldSendToDLQ(failureCount: number, maxRetries = 3): boolean {
  return failureCount >= maxRetries;
}

