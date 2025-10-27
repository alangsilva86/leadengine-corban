/**
 * Simple Cache
 * 
 * Cache em memória simples com TTL para reduzir queries ao banco de dados.
 * Ideal para dados que mudam pouco e são consultados frequentemente.
 */

import { logger } from '../config/logger';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheOptions {
  /** Nome do cache para identificação em logs */
  name: string;
  /** TTL padrão em milissegundos */
  ttlMs: number;
  /** Tamanho máximo do cache (0 = ilimitado) */
  maxSize?: number;
}

export class SimpleCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly options: Required<CacheOptions>;

  constructor(options: CacheOptions) {
    this.options = {
      maxSize: 1000,
      ...options,
    };
  }

  /**
   * Obtém um valor do cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Verifica se expirou
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Define um valor no cache
   */
  set(key: K, value: V, ttlMs?: number): void {
    const ttl = ttlMs ?? this.options.ttlMs;
    const expiresAt = Date.now() + ttl;

    // Se atingiu o tamanho máximo, remove o mais antigo
    if (this.options.maxSize > 0 && this.cache.size >= this.options.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Remove um valor do cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared', { name: this.options.name });
  }

  /**
   * Remove entradas expiradas
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('Cache cleanup completed', {
        name: this.options.name,
        removed,
        remaining: this.cache.size,
      });
    }

    return removed;
  }

  /**
   * Retorna estatísticas do cache
   */
  getStats() {
    return {
      name: this.options.name,
      size: this.cache.size,
      maxSize: this.options.maxSize,
      ttlMs: this.options.ttlMs,
    };
  }

  /**
   * Obtém ou define um valor usando uma função factory
   */
  async getOrSet(key: K, factory: () => Promise<V>, ttlMs?: number): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }
}

/**
 * Cria um novo cache
 */
export function createCache<K, V>(options: CacheOptions): SimpleCache<K, V> {
  return new SimpleCache<K, V>(options);
}

/**
 * Gerenciador global de caches com limpeza periódica
 */
class CacheManager {
  private caches = new Set<SimpleCache<any, any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  register<K, V>(cache: SimpleCache<K, V>): void {
    this.caches.add(cache);
    this.ensureCleanup();
  }

  unregister<K, V>(cache: SimpleCache<K, V>): void {
    this.caches.delete(cache);
  }

  private ensureCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    // Executa limpeza a cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      for (const cache of this.caches) {
        cache.cleanup();
      }
    }, 5 * 60 * 1000);

    // Permite que o processo termine mesmo com o interval ativo
    this.cleanupInterval.unref();
  }

  clearAll(): void {
    for (const cache of this.caches) {
      cache.clear();
    }
  }

  getStats() {
    return Array.from(this.caches).map(cache => cache.getStats());
  }
}

export const cacheManager = new CacheManager();

