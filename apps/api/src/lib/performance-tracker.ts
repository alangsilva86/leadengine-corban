/**
 * Performance Tracker
 * 
 * Utilitário para medir latência de operações e exportar métricas.
 * Compatível com o sistema de logging e métricas existente.
 */

import { logger } from '../config/logger';

export interface PerformanceSpan {
  name: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMeasurement {
  name: string;
  durationMs: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Classe para rastrear performance de operações
 */
export class PerformanceTracker {
  private spans: Map<string, PerformanceSpan> = new Map();
  private measurements: PerformanceMeasurement[] = [];
  private context: Record<string, unknown>;

  constructor(context: Record<string, unknown> = {}) {
    this.context = context;
  }

  /**
   * Inicia uma medição
   */
  start(name: string, metadata?: Record<string, unknown>): void {
    this.spans.set(name, {
      name,
      startTime: performance.now(),
      metadata,
    });
  }

  /**
   * Finaliza uma medição e retorna a duração
   */
  end(name: string, metadata?: Record<string, unknown>): number {
    const span = this.spans.get(name);
    if (!span) {
      logger.warn('Performance span not found', { name, context: this.context });
      return 0;
    }

    const durationMs = performance.now() - span.startTime;
    const measurement: PerformanceMeasurement = {
      name,
      durationMs,
      timestamp: new Date().toISOString(),
      metadata: { ...span.metadata, ...metadata },
    };

    this.measurements.push(measurement);
    this.spans.delete(name);

    return durationMs;
  }

  /**
   * Executa uma função e mede seu tempo de execução
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.start(name, metadata);
    try {
      const result = await fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name, { error: true });
      throw error;
    }
  }

  /**
   * Retorna todas as medições realizadas
   */
  getMeasurements(): PerformanceMeasurement[] {
    return [...this.measurements];
  }

  /**
   * Retorna a duração total de todas as medições
   */
  getTotalDuration(): number {
    return this.measurements.reduce((sum, m) => sum + m.durationMs, 0);
  }

  /**
   * Loga um resumo das medições
   */
  logSummary(level: 'info' | 'debug' = 'info'): void {
    const total = this.getTotalDuration();
    const breakdown = this.measurements.map(m => ({
      name: m.name,
      durationMs: Math.round(m.durationMs * 100) / 100,
      percentage: Math.round((m.durationMs / total) * 100),
    }));

    logger[level]('Performance summary', {
      ...this.context,
      totalDurationMs: Math.round(total * 100) / 100,
      breakdown,
    });
  }

  /**
   * Reseta todas as medições
   */
  reset(): void {
    this.spans.clear();
    this.measurements = [];
  }
}

/**
 * Cria um novo tracker de performance
 */
export const createPerformanceTracker = (context?: Record<string, unknown>): PerformanceTracker => {
  return new PerformanceTracker(context);
};

/**
 * Decorator para medir performance de métodos
 */
export function measurePerformance(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const measurementName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now();
      try {
        const result = await originalMethod.apply(this, args);
        const durationMs = performance.now() - startTime;
        
        logger.debug('Method performance', {
          method: measurementName,
          durationMs: Math.round(durationMs * 100) / 100,
        });

        return result;
      } catch (error) {
        const durationMs = performance.now() - startTime;
        logger.debug('Method performance (error)', {
          method: measurementName,
          durationMs: Math.round(durationMs * 100) / 100,
          error: true,
        });
        throw error;
      }
    };

    return descriptor;
  };
}

