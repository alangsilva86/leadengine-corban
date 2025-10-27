/**
 * Testes para CircuitBreaker
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CircuitBreaker, CircuitState, CircuitBreakerError, createCircuitBreaker } from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let successFn: jest.Mock<() => Promise<string>>;
  let failureFn: jest.Mock<() => Promise<never>>;

  beforeEach(() => {
    successFn = jest.fn(async () => 'success');
    failureFn = jest.fn(async () => {
      throw new Error('Failure');
    });
  });

  describe('CLOSED state', () => {
    it('should execute function successfully', async () => {
      const breaker = createCircuitBreaker(successFn, {
        name: 'test',
        failureThreshold: 3,
        resetTimeout: 1000,
        timeout: 5000,
      });

      const result = await breaker.execute();
      expect(result).toBe('success');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should remain closed on occasional failures', async () => {
      const breaker = createCircuitBreaker(failureFn, {
        name: 'test',
        failureThreshold: 3,
        resetTimeout: 1000,
        timeout: 5000,
      });

      await expect(breaker.execute()).rejects.toThrow('Failure');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      
      await expect(breaker.execute()).rejects.toThrow('Failure');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('OPEN state', () => {
    it('should open after threshold failures', async () => {
      const breaker = createCircuitBreaker(failureFn, {
        name: 'test',
        failureThreshold: 3,
        resetTimeout: 1000,
        timeout: 5000,
      });

      // Trigger failures to reach threshold
      await expect(breaker.execute()).rejects.toThrow('Failure');
      await expect(breaker.execute()).rejects.toThrow('Failure');
      await expect(breaker.execute()).rejects.toThrow('Failure');

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject immediately when open', async () => {
      const breaker = createCircuitBreaker(failureFn, {
        name: 'test',
        failureThreshold: 2,
        resetTimeout: 1000,
        timeout: 5000,
      });

      // Open the circuit
      await expect(breaker.execute()).rejects.toThrow('Failure');
      await expect(breaker.execute()).rejects.toThrow('Failure');

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Should reject without calling function
      const callCount = failureFn.mock.calls.length;
      await expect(breaker.execute()).rejects.toThrow(CircuitBreakerError);
      expect(failureFn.mock.calls.length).toBe(callCount); // No new calls
    });
  });

  describe('HALF_OPEN state', () => {
    it('should transition to HALF_OPEN after reset timeout', async () => {
      const breaker = createCircuitBreaker(successFn, {
        name: 'test',
        failureThreshold: 2,
        resetTimeout: 100, // Short timeout for testing
        timeout: 5000,
        successThreshold: 2,
      });

      // Open the circuit
      const failFn = jest.fn(async () => {
        throw new Error('Failure');
      });
      const failBreaker = createCircuitBreaker(failFn, {
        name: 'test',
        failureThreshold: 2,
        resetTimeout: 100,
        timeout: 5000,
      });

      await expect(failBreaker.execute()).rejects.toThrow('Failure');
      await expect(failBreaker.execute()).rejects.toThrow('Failure');
      expect(failBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next call should transition to HALF_OPEN
      await expect(failBreaker.execute()).rejects.toThrow('Failure');
      expect(failBreaker.getState()).toBe(CircuitState.OPEN); // Back to OPEN after failure
    });

    it('should close after successful calls in HALF_OPEN', async () => {
      const mixedFn = jest.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success');

      const breaker = createCircuitBreaker(mixedFn, {
        name: 'test',
        failureThreshold: 2,
        resetTimeout: 100,
        timeout: 5000,
        successThreshold: 2,
      });

      // Open circuit
      await expect(breaker.execute()).rejects.toThrow('Failure');
      await expect(breaker.execute()).rejects.toThrow('Failure');
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset
      await new Promise(resolve => setTimeout(resolve, 150));

      // Successful calls should close circuit
      await breaker.execute();
      await breaker.execute();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('timeout', () => {
    it('should timeout long-running operations', async () => {
      const slowFn = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'too slow';
      });

      const breaker = createCircuitBreaker(slowFn, {
        name: 'test',
        failureThreshold: 3,
        resetTimeout: 1000,
        timeout: 100, // Short timeout
      });

      await expect(breaker.execute()).rejects.toThrow('Timeout');
    });
  });

  describe('reset', () => {
    it('should manually reset circuit', async () => {
      const breaker = createCircuitBreaker(failureFn, {
        name: 'test',
        failureThreshold: 2,
        resetTimeout: 10000,
        timeout: 5000,
      });

      // Open circuit
      await expect(breaker.execute()).rejects.toThrow('Failure');
      await expect(breaker.execute()).rejects.toThrow('Failure');
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Manual reset
      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('getMetrics', () => {
    it('should return circuit metrics', async () => {
      const breaker = createCircuitBreaker(failureFn, {
        name: 'test-circuit',
        failureThreshold: 3,
        resetTimeout: 1000,
        timeout: 5000,
      });

      await expect(breaker.execute()).rejects.toThrow('Failure');

      const metrics = breaker.getMetrics();
      expect(metrics.name).toBe('test-circuit');
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failureCount).toBe(1);
    });
  });
});

