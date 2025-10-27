/**
 * Testes para FailedMessageDLQ
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { failedMessageDLQ, sendToFailedMessageDLQ, shouldSendToDLQ } from '../failed-message-dlq';

describe('FailedMessageDLQ', () => {
  beforeEach(() => {
    failedMessageDLQ.clear();
  });

  describe('add and get', () => {
    it('should store and retrieve failed messages', () => {
      const message = {
        id: 'msg-1',
        tenantId: 'tenant-1',
        instanceId: 'instance-1',
        timestamp: new Date().toISOString(),
        failureReason: 'Test failure',
        failureCount: 1,
        lastError: 'Error stack trace',
        payload: { test: 'data' },
        metadata: { requestId: 'req-1' },
      };

      failedMessageDLQ.add(message);
      const retrieved = failedMessageDLQ.get('msg-1');

      expect(retrieved).toEqual(message);
    });

    it('should return undefined for non-existent message', () => {
      const retrieved = failedMessageDLQ.get('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('list', () => {
    beforeEach(() => {
      failedMessageDLQ.add({
        id: 'msg-1',
        tenantId: 'tenant-1',
        instanceId: 'instance-1',
        timestamp: new Date().toISOString(),
        failureReason: 'Reason 1',
        failureCount: 1,
        lastError: 'Error 1',
        payload: {},
        metadata: {},
      });

      failedMessageDLQ.add({
        id: 'msg-2',
        tenantId: 'tenant-2',
        instanceId: 'instance-1',
        timestamp: new Date().toISOString(),
        failureReason: 'Reason 2',
        failureCount: 2,
        lastError: 'Error 2',
        payload: {},
        metadata: {},
      });
    });

    it('should list all messages', () => {
      const messages = failedMessageDLQ.list();
      expect(messages).toHaveLength(2);
    });

    it('should filter by tenantId', () => {
      const messages = failedMessageDLQ.list({ tenantId: 'tenant-1' });
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');
    });

    it('should filter by instanceId', () => {
      const messages = failedMessageDLQ.list({ instanceId: 'instance-1' });
      expect(messages).toHaveLength(2);
    });

    it('should respect limit', () => {
      const messages = failedMessageDLQ.list({ limit: 1 });
      expect(messages).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('should remove message from DLQ', () => {
      failedMessageDLQ.add({
        id: 'msg-1',
        tenantId: 'tenant-1',
        instanceId: 'instance-1',
        timestamp: new Date().toISOString(),
        failureReason: 'Test',
        failureCount: 1,
        lastError: 'Error',
        payload: {},
        metadata: {},
      });

      expect(failedMessageDLQ.get('msg-1')).toBeDefined();
      
      const removed = failedMessageDLQ.remove('msg-1');
      expect(removed).toBe(true);
      expect(failedMessageDLQ.get('msg-1')).toBeUndefined();
    });

    it('should return false for non-existent message', () => {
      const removed = failedMessageDLQ.remove('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all messages', () => {
      failedMessageDLQ.add({
        id: 'msg-1',
        tenantId: 'tenant-1',
        instanceId: 'instance-1',
        timestamp: new Date().toISOString(),
        failureReason: 'Test',
        failureCount: 1,
        lastError: 'Error',
        payload: {},
        metadata: {},
      });

      failedMessageDLQ.clear();
      expect(failedMessageDLQ.list()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return DLQ statistics', () => {
      failedMessageDLQ.add({
        id: 'msg-1',
        tenantId: 'tenant-1',
        instanceId: 'instance-1',
        timestamp: new Date().toISOString(),
        failureReason: 'Database error',
        failureCount: 1,
        lastError: 'Error',
        payload: {},
        metadata: {},
      });

      failedMessageDLQ.add({
        id: 'msg-2',
        tenantId: 'tenant-1',
        instanceId: 'instance-2',
        timestamp: new Date().toISOString(),
        failureReason: 'Network error',
        failureCount: 2,
        lastError: 'Error',
        payload: {},
        metadata: {},
      });

      const stats = failedMessageDLQ.getStats();
      expect(stats.total).toBe(2);
      expect(stats.byTenant['tenant-1']).toBe(2);
      expect(stats.byReason['Database error']).toBe(1);
      expect(stats.byReason['Network error']).toBe(1);
    });
  });
});

describe('sendToFailedMessageDLQ', () => {
  beforeEach(() => {
    failedMessageDLQ.clear();
  });

  it('should add message with error details', () => {
    const error = new Error('Test error');
    sendToFailedMessageDLQ('msg-1', 'tenant-1', error, {
      instanceId: 'instance-1',
      failureCount: 3,
      payload: { test: 'data' },
      metadata: { requestId: 'req-1' },
    });

    const message = failedMessageDLQ.get('msg-1');
    expect(message).toBeDefined();
    expect(message?.failureReason).toBe('Test error');
    expect(message?.failureCount).toBe(3);
  });

  it('should handle non-Error objects', () => {
    sendToFailedMessageDLQ('msg-1', 'tenant-1', 'String error');

    const message = failedMessageDLQ.get('msg-1');
    expect(message?.failureReason).toBe('String error');
  });
});

describe('shouldSendToDLQ', () => {
  it('should return true when failure count reaches threshold', () => {
    expect(shouldSendToDLQ(3, 3)).toBe(true);
    expect(shouldSendToDLQ(4, 3)).toBe(true);
  });

  it('should return false when below threshold', () => {
    expect(shouldSendToDLQ(1, 3)).toBe(false);
    expect(shouldSendToDLQ(2, 3)).toBe(false);
  });

  it('should use default threshold of 3', () => {
    expect(shouldSendToDLQ(3)).toBe(true);
    expect(shouldSendToDLQ(2)).toBe(false);
  });
});

