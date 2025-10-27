/**
 * Testes para PerformanceTracker
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PerformanceTracker, createPerformanceTracker } from '../performance-tracker';

describe('PerformanceTracker', () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = createPerformanceTracker({ operation: 'test' });
  });

  describe('start and end', () => {
    it('should measure duration correctly', () => {
      tracker.start('operation1');
      const duration = tracker.end('operation1');

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(100); // Assume menos de 100ms
    });

    it('should return 0 for non-existent span', () => {
      const duration = tracker.end('non-existent');
      expect(duration).toBe(0);
    });

    it('should track multiple operations', () => {
      tracker.start('op1');
      tracker.start('op2');
      
      const duration1 = tracker.end('op1');
      const duration2 = tracker.end('op2');

      expect(duration1).toBeGreaterThanOrEqual(0);
      expect(duration2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('measure', () => {
    it('should measure async function execution', async () => {
      const result = await tracker.measure('async-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });

      expect(result).toBe('success');
      const measurements = tracker.getMeasurements();
      expect(measurements).toHaveLength(1);
      expect(measurements[0].name).toBe('async-op');
      expect(measurements[0].durationMs).toBeGreaterThanOrEqual(10);
    });

    it('should track error in metadata', async () => {
      await expect(
        tracker.measure('failing-op', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      const measurements = tracker.getMeasurements();
      expect(measurements).toHaveLength(1);
      expect(measurements[0].metadata?.error).toBe(true);
    });
  });

  describe('getMeasurements', () => {
    it('should return all measurements', () => {
      tracker.start('op1');
      tracker.end('op1');
      tracker.start('op2');
      tracker.end('op2');

      const measurements = tracker.getMeasurements();
      expect(measurements).toHaveLength(2);
      expect(measurements[0].name).toBe('op1');
      expect(measurements[1].name).toBe('op2');
    });
  });

  describe('getTotalDuration', () => {
    it('should sum all durations', () => {
      tracker.start('op1');
      tracker.end('op1');
      tracker.start('op2');
      tracker.end('op2');

      const total = tracker.getTotalDuration();
      expect(total).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for empty tracker', () => {
      const total = tracker.getTotalDuration();
      expect(total).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all measurements', () => {
      tracker.start('op1');
      tracker.end('op1');
      
      expect(tracker.getMeasurements()).toHaveLength(1);
      
      tracker.reset();
      
      expect(tracker.getMeasurements()).toHaveLength(0);
      expect(tracker.getTotalDuration()).toBe(0);
    });
  });
});

