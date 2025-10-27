/**
 * Circuit Breaker Implementation
 * 
 * Implementação nativa de Circuit Breaker para proteger chamadas a serviços externos.
 * Baseado no padrão descrito por Michael Nygard em "Release It!".
 */

import { logger } from '../config/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Funcionamento normal
  OPEN = 'OPEN',         // Circuito aberto, rejeitando requisições
  HALF_OPEN = 'HALF_OPEN' // Testando se o serviço voltou
}

export interface CircuitBreakerOptions {
  /** Nome do circuito para identificação em logs */
  name: string;
  /** Número de falhas consecutivas antes de abrir o circuito */
  failureThreshold: number;
  /** Tempo em ms para tentar fechar o circuito após abrir */
  resetTimeout: number;
  /** Timeout em ms para cada requisição */
  timeout: number;
  /** Número de requisições de teste em HALF_OPEN antes de fechar */
  successThreshold?: number;
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly state: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker<T extends (...args: any[]) => Promise<any>> {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(
    private readonly fn: T,
    options: CircuitBreakerOptions
  ) {
    this.options = {
      successThreshold: 2,
      ...options,
    };
  }

  /**
   * Executa a função protegida pelo circuit breaker
   */
  async execute(...args: Parameters<T>): Promise<ReturnType<T>> {
    // Verifica se o circuito está aberto
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.options.name}`,
          CircuitState.OPEN
        );
      }
      // Tempo de reset atingido, muda para HALF_OPEN
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      logger.info('Circuit breaker transitioning to HALF_OPEN', {
        name: this.options.name,
      });
    }

    try {
      // Executa a função com timeout
      const result = await this.executeWithTimeout(args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Executa a função com timeout configurado
   */
  private async executeWithTimeout(args: Parameters<T>): Promise<ReturnType<T>> {
    return Promise.race([
      this.fn(...args),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout after ${this.options.timeout}ms`)),
          this.options.timeout
        )
      ),
    ]);
  }

  /**
   * Callback de sucesso
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        logger.info('Circuit breaker closed after successful recovery', {
          name: this.options.name,
        });
      }
    }
  }

  /**
   * Callback de falha
   */
  private onFailure(error: unknown): void {
    this.failureCount++;
    this.successCount = 0;

    logger.warn('Circuit breaker registered failure', {
      name: this.options.name,
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
      state: this.state,
      error: error instanceof Error ? error.message : String(error),
    });

    if (
      this.failureCount >= this.options.failureThreshold ||
      this.state === CircuitState.HALF_OPEN
    ) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      logger.error('Circuit breaker opened', {
        name: this.options.name,
        failureCount: this.failureCount,
        resetTimeout: this.options.resetTimeout,
        nextAttempt: new Date(this.nextAttempt).toISOString(),
      });
    }
  }

  /**
   * Retorna o estado atual do circuito
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Retorna métricas do circuito
   */
  getMetrics() {
    return {
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.state === CircuitState.OPEN ? new Date(this.nextAttempt).toISOString() : null,
    };
  }

  /**
   * Reseta manualmente o circuito (para testes ou operações manuais)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    logger.info('Circuit breaker manually reset', {
      name: this.options.name,
    });
  }
}

/**
 * Cria um circuit breaker para uma função
 */
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: CircuitBreakerOptions
): CircuitBreaker<T> {
  return new CircuitBreaker(fn, options);
}

