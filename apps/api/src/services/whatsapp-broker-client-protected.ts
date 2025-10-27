/**
 * WhatsApp Broker Client com Circuit Breaker
 * 
 * Wrapper que adiciona proteção de circuit breaker às chamadas do broker,
 * mantendo compatibilidade total com o código existente.
 */

import { createCircuitBreaker, CircuitBreaker, CircuitBreakerError } from '../lib/circuit-breaker';
import {
  performWhatsAppBrokerRequest as originalPerformRequest,
  type BrokerRequestOptions,
  type WhatsAppBrokerResolvedConfig,
  WhatsAppBrokerError,
} from './whatsapp-broker-client';
import { logger } from '../config/logger';

// Circuit breaker global para o broker
let brokerCircuitBreaker: CircuitBreaker<typeof originalPerformRequest> | null = null;

/**
 * Inicializa o circuit breaker do broker (chamado na inicialização da API)
 */
export function initializeBrokerCircuitBreaker(): void {
  if (brokerCircuitBreaker) {
    logger.warn('Broker circuit breaker already initialized');
    return;
  }

  brokerCircuitBreaker = createCircuitBreaker(originalPerformRequest, {
    name: 'whatsapp-broker',
    failureThreshold: 5,        // Abre após 5 falhas consecutivas
    resetTimeout: 30000,        // Tenta novamente após 30s
    timeout: 30000,             // Timeout de 30s por requisição
    successThreshold: 2,        // Fecha após 2 sucessos em HALF_OPEN
  });

  logger.info('Broker circuit breaker initialized', brokerCircuitBreaker.getMetrics());
}

/**
 * Retorna métricas do circuit breaker (para health check)
 */
export function getBrokerCircuitBreakerMetrics() {
  if (!brokerCircuitBreaker) {
    return { initialized: false };
  }
  return { initialized: true, ...brokerCircuitBreaker.getMetrics() };
}

/**
 * Reseta manualmente o circuit breaker (para operações administrativas)
 */
export function resetBrokerCircuitBreaker(): void {
  if (brokerCircuitBreaker) {
    brokerCircuitBreaker.reset();
    logger.info('Broker circuit breaker manually reset');
  }
}

/**
 * Versão protegida de performWhatsAppBrokerRequest com circuit breaker
 * 
 * Drop-in replacement que mantém a mesma assinatura.
 */
export async function performWhatsAppBrokerRequest<T>(
  path: string,
  init?: RequestInit,
  options?: BrokerRequestOptions,
  config?: WhatsAppBrokerResolvedConfig
): Promise<T> {
  // Se circuit breaker não foi inicializado, usa função original
  if (!brokerCircuitBreaker) {
    logger.warn('Circuit breaker not initialized, using unprotected broker client');
    return originalPerformRequest<T>(path, init, options, config);
  }

  try {
    // Executa através do circuit breaker
    return await brokerCircuitBreaker.execute(path, init, options, config);
  } catch (error) {
    // Se o circuito está aberto, retorna erro específico
    if (error instanceof CircuitBreakerError) {
      throw new WhatsAppBrokerError(
        'WhatsApp broker circuit breaker is OPEN - service temporarily unavailable',
        {
          code: 'CIRCUIT_BREAKER_OPEN',
          brokerStatus: 503,
          cause: error,
        }
      );
    }
    // Propaga outros erros normalmente
    throw error;
  }
}

/**
 * Re-exporta tipos e classes para compatibilidade
 */
export {
  WhatsAppBrokerError,
  WhatsAppBrokerNotConfiguredError,
  type BrokerRequestOptions,
  type WhatsAppBrokerResolvedConfig,
  type WhatsAppMessageResult,
} from './whatsapp-broker-client';

export {
  resolveWhatsAppBrokerConfig,
  buildWhatsAppBrokerUrl,
} from './whatsapp-broker-client';

