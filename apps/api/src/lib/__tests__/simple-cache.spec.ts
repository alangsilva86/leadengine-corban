/**
 * Testes para SimpleCache
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SimpleCache, createCache } from '../simple-cache';

describe('SimpleCache', () => {
  let cache: SimpleCache<string, string>;

  beforeEach(() => {
    cache = createCache({
      name: 'test-cache',
      ttlMs: 1000,
      maxSize: 3,
    });
  });

  describe('get and set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeUndefined();
    });

    it('should respect TTL', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL
      expect(cache.get('key1')).toBe('value1');

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should use default TTL when not specified', async () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('maxSize', () => {
    it('should evict oldest entry when max size reached', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should evict key1

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });
  });

  describe('delete', () => {
    it('should remove entry from cache', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false for non-existent key', () => {
      const deleted = cache.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 1000);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const removed = cache.cleanup();
      expect(removed).toBe(1);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should return 0 when no entries expired', () => {
      cache.set('key1', 'value1');
      const removed = cache.cleanup();
      expect(removed).toBe(0);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      cache.set('key1', 'cached-value');
      
      const factory = jest.fn(async () => 'new-value');
      const result = await cache.getOrSet('key1', factory);
      
      expect(result).toBe('cached-value');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const factory = jest.fn(async () => 'new-value');
      const result = await cache.getOrSet('key1', factory);
      
      expect(result).toBe('new-value');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('new-value');
    });

    it('should use custom TTL when provided', async () => {
      const factory = jest.fn(async () => 'new-value');
      await cache.getOrSet('key1', factory, 100);
      
      expect(cache.get('key1')).toBe('new-value');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      expect(stats.name).toBe('test-cache');
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.ttlMs).toBe(1000);
    });
  });
});

