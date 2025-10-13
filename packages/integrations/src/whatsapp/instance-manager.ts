import { BaileysWhatsAppProvider, type WhatsAppConfig, type ConnectionStatus } from './baileys-provider';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';
import type { WhatsAppSessionStore } from './session-store';

/**
 * @deprecated The WhatsApp sidecar runtime has been removed. This manager will be deleted in a future release.
 */
export interface WhatsAppInstanceManagerOptions {
  sessionStore?: WhatsAppSessionStore;
  sessionsPath?: string;
  environment?: string;
  reconnect?: Partial<ReconnectConfig>;
}

/**
 * @deprecated The WhatsApp sidecar runtime has been removed. This manager will be deleted in a future release.
 */
export interface ReconnectConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  maxAttempts: number;
}

/**
 * @deprecated The WhatsApp sidecar runtime has been removed. This manager will be deleted in a future release.
 */
export interface WhatsAppLifecycleObserver {
  onConnected?(payload: { instance: WhatsAppInstance }): void | Promise<void>;
  onDisconnected?(payload: { instance: WhatsAppInstance; error?: unknown }): void | Promise<void>;
  onReconnectAttempt?(payload: { instance: WhatsAppInstance; attempt: number; delayMs: number }): void | Promise<void>;
}

/**
 * @deprecated The WhatsApp sidecar runtime has been removed. This manager will be deleted in a future release.
 */
export interface WhatsAppInstance {
  id: string;
  tenantId: string;
  name: string;
  status: ConnectionStatus;
  provider: BaileysWhatsAppProvider;
  createdAt: Date;
  lastActivity?: Date;
}

/**
 * @deprecated The WhatsApp sidecar runtime has been removed. This manager will be deleted in a future release.
 */
export interface CreateInstanceRequest {
  tenantId: string;
  name: string;
  webhookUrl?: string;
}

/**
 * @deprecated The WhatsApp sidecar runtime has been removed. This manager will be deleted in a future release.
 */
export class WhatsAppInstanceManager extends EventEmitter {
  private instances = new Map<string, WhatsAppInstance>();
  private sessionsPath: string;
  private sessionStore: WhatsAppSessionStore | undefined;
  private environment: string;
  private reconnectConfig: ReconnectConfig;
  private reconnectState = new Map<
    string,
    { attempt: number; timer: NodeJS.Timeout | null }
  >();
  private lifecycleObservers = new Set<WhatsAppLifecycleObserver>();
  private shuttingDown = false;
  private manualDisconnecting = new Set<string>();

  constructor(options: WhatsAppInstanceManagerOptions = {}) {
    super();
    this.sessionStore = options.sessionStore;
    this.sessionsPath = options.sessionsPath ?? './sessions';
    this.environment = options.environment ?? process.env.NODE_ENV ?? 'development';
    this.reconnectConfig = {
      initialDelayMs: 2000,
      multiplier: 2,
      maxDelayMs: 60000,
      maxAttempts: 10,
      ...options.reconnect
    };

    if (!this.sessionStore && this.environment !== 'development') {
      throw new Error('WhatsApp session store is required outside development environments');
    }

    if (this.shouldUseDiskStorage()) {
      void this.ensureSessionsDirectory();
    }
  }

  private shouldUseDiskStorage(): boolean {
    return !this.sessionStore;
  }

  private async ensureSessionsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create sessions directory:', error);
    }
  }

  private async resolveSessionConfig(
    instanceId: string
  ): Promise<Pick<WhatsAppConfig, 'sessionPath' | 'sessionStore'>> {
    if (this.sessionStore) {
      return { sessionStore: this.sessionStore };
    }

    if (!this.shouldUseDiskStorage()) {
      throw new Error('No WhatsApp session storage configured');
    }

    const sessionPath = path.join(this.sessionsPath, instanceId);
    try {
      await fs.mkdir(sessionPath, { recursive: true });
    } catch (error) {
      logger.error(`Failed to prepare session path for instance ${instanceId}:`, error);
    }

    return { sessionPath };
  }

  registerLifecycleObserver(observer: WhatsAppLifecycleObserver): () => void {
    this.lifecycleObservers.add(observer);
    return () => {
      this.lifecycleObservers.delete(observer);
    };
  }

  private async notifyLifecycle<K extends keyof WhatsAppLifecycleObserver>(
    method: K,
    payload: Parameters<NonNullable<WhatsAppLifecycleObserver[K]>>[0]
  ): Promise<void> {
    await Promise.all(
      Array.from(this.lifecycleObservers).map(async observer => {
        const handler = observer[method];
        if (handler) {
          try {
            await handler(payload as never);
          } catch (error) {
            logger.warn('WhatsApp lifecycle observer failed', { method, error });
          }
        }
      })
    );
  }

  private clearReconnectState(instanceId: string): void {
    const state = this.reconnectState.get(instanceId);
    if (state?.timer) {
      clearTimeout(state.timer);
    }
    this.reconnectState.delete(instanceId);
  }

  private scheduleReconnect(instance: WhatsAppInstance, error?: unknown): void {
    if (this.shuttingDown) return;

    const current = this.reconnectState.get(instance.id) ?? { attempt: 0, timer: null };

    if (current.attempt >= this.reconnectConfig.maxAttempts) {
      logger.error('Max reconnect attempts reached', { instanceId: instance.id });
      this.clearReconnectState(instance.id);
      return;
    }

    const attempt = current.attempt + 1;
    const delay = Math.min(
      this.reconnectConfig.initialDelayMs * Math.pow(this.reconnectConfig.multiplier, attempt - 1),
      this.reconnectConfig.maxDelayMs
    );

    logger.info('Scheduling WhatsApp reconnect', {
      instanceId: instance.id,
      attempt,
      delay
    });

    void this.notifyLifecycle('onReconnectAttempt', { instance, attempt, delayMs: delay });
    this.emit('instance.reconnect', { instance, attempt, delayMs: delay, error });

    const timer = setTimeout(async () => {
      try {
        await instance.provider.initialize();
      } catch (reconnectError) {
        logger.error('WhatsApp reconnect attempt failed', {
          instanceId: instance.id,
          attempt,
          error: reconnectError
        });
        this.scheduleReconnect(instance, reconnectError);
      }
    }, delay);

    this.reconnectState.set(instance.id, { attempt, timer });
  }

  async createInstance(request: CreateInstanceRequest): Promise<WhatsAppInstance> {
    const instanceId = this.generateInstanceId(request.tenantId);

    if (this.instances.has(instanceId)) {
      throw new Error(`Instance ${instanceId} already exists`);
    }

    const sessionConfig = await this.resolveSessionConfig(instanceId);

    const config: WhatsAppConfig = {
      instanceId,
      ...sessionConfig,
      qrCodeCallback: (qr) => this.handleQRCode(instanceId, qr),
      statusCallback: (status) => this.handleStatusChange(instanceId, status)
    };

    if (request.webhookUrl !== undefined) {
      config.webhookUrl = request.webhookUrl;
    }

    const provider = new BaileysWhatsAppProvider(config);
    
    const instance: WhatsAppInstance = {
      id: instanceId,
      tenantId: request.tenantId,
      name: request.name,
      status: 'disconnected',
      provider,
      createdAt: new Date()
    };

    // Setup provider event listeners
    this.setupProviderEvents(instance);

    this.instances.set(instanceId, instance);

    logger.info('WhatsApp instance created:', {
      instanceId,
      tenantId: request.tenantId,
      name: request.name
    });

    this.emit('instance.created', instance);

    return instance;
  }

  async startInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    try {
      await instance.provider.initialize();
      logger.info(`Instance ${instanceId} started`);
    } catch (error) {
      logger.error(`Failed to start instance ${instanceId}:`, error);
      throw error;
    }
  }

  async stopInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    try {
      this.manualDisconnecting.add(instanceId);
      this.clearReconnectState(instanceId);
      await instance.provider.disconnect();
      instance.status = 'disconnected';
      logger.info(`Instance ${instanceId} stopped`);
      this.emit('instance.stopped', instance);
    } catch (error) {
      logger.error(`Failed to stop instance ${instanceId}:`, error);
      throw error;
    } finally {
      this.manualDisconnecting.delete(instanceId);
    }
  }

  async deleteInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    // Stop the instance first
    if (instance.status !== 'disconnected') {
      await this.stopInstance(instanceId);
    }

    // Remove session data
    if (this.sessionStore) {
      try {
        await this.sessionStore.delete(instanceId);
      } catch (error) {
        logger.warn(`Failed to delete session store for ${instanceId}:`, error);
      }
    } else {
      try {
        const sessionPath = path.join(this.sessionsPath, instanceId);
        await fs.rm(sessionPath, { recursive: true, force: true });
      } catch (error) {
        logger.warn(`Failed to remove session files for ${instanceId}:`, error);
      }
    }

    this.instances.delete(instanceId);

    logger.info(`Instance ${instanceId} deleted`);
    this.emit('instance.deleted', { instanceId });
  }

  async sendMessage(
    instanceId: string,
    to: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<{ externalId: string; status: string }> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (!instance.provider.isConnected()) {
      throw new Error(`Instance ${instanceId} is not connected`);
    }

    const result = await instance.provider.sendMessage('whatsapp', to, content, metadata);
    
    instance.lastActivity = new Date();
    this.emit('message.sent', { instanceId, to, content, result });
    
    return result;
  }

  async sendMedia(
    instanceId: string,
    to: string,
    mediaUrl: string,
    caption?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ externalId: string; status: string }> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (!instance.provider.isConnected()) {
      throw new Error(`Instance ${instanceId} is not connected`);
    }

    const result = await instance.provider.sendMedia('whatsapp', to, mediaUrl, caption, metadata);
    
    instance.lastActivity = new Date();
    this.emit('media.sent', { instanceId, to, mediaUrl, caption, result });
    
    return result;
  }

  getInstance(instanceId: string): WhatsAppInstance | undefined {
    return this.instances.get(instanceId);
  }

  getInstancesByTenant(tenantId: string): WhatsAppInstance[] {
    return Array.from(this.instances.values()).filter(
      instance => instance.tenantId === tenantId
    );
  }

  getAllInstances(): WhatsAppInstance[] {
    return Array.from(this.instances.values());
  }

  getInstanceStatus(instanceId: string): ConnectionStatus | null {
    const instance = this.instances.get(instanceId);
    return instance ? instance.status : null;
  }

  private setupProviderEvents(instance: WhatsAppInstance): void {
    const { provider } = instance;

    provider.on('message', (message) => {
      instance.lastActivity = new Date();
      this.emit('message.received', {
        instanceId: instance.id,
        tenantId: instance.tenantId,
        message
      });
    });

    provider.on('message.update', (update) => {
      this.emit('message.update', {
        instanceId: instance.id,
        tenantId: instance.tenantId,
        update
      });
    });

    provider.on('connected', () => {
      instance.status = 'connected';
      this.clearReconnectState(instance.id);
      this.emit('instance.connected', instance);
      void this.notifyLifecycle('onConnected', { instance });
    });

    provider.on('disconnected', (error) => {
      instance.status = 'disconnected';
      this.emit('instance.disconnected', { instance, error });
      void this.notifyLifecycle('onDisconnected', { instance, error });
    });

    provider.on('connection.closed', ({ error, shouldReconnect }) => {
      if (this.manualDisconnecting.has(instance.id) || this.shuttingDown) {
        this.manualDisconnecting.delete(instance.id);
        this.clearReconnectState(instance.id);
        return;
      }

      if (shouldReconnect) {
        this.scheduleReconnect(instance, error);
      } else {
        this.clearReconnectState(instance.id);
      }
    });

    provider.on('presence.update', (presence) => {
      this.emit('presence.update', {
        instanceId: instance.id,
        tenantId: instance.tenantId,
        presence
      });
    });
  }

  private handleQRCode(instanceId: string, qr: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = 'qr_required';
      this.emit('qr.generated', { instanceId, qr, instance });
    }
  }

  private handleStatusChange(instanceId: string, status: ConnectionStatus): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = status;
      this.emit('status.changed', { instanceId, status, instance });
    }
  }

  private generateInstanceId(tenantId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${tenantId}_${timestamp}_${random}`;
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    const instanceIds = Array.from(this.instances.keys());

    for (const instanceId of instanceIds) {
      this.clearReconnectState(instanceId);
    }

    await Promise.all(
      instanceIds.map(async instanceId => {
        try {
          await this.stopInstance(instanceId);
        } catch (error) {
          logger.error(`Failed to shutdown WhatsApp instance ${instanceId}:`, error);
        }
      })
    );

    this.shuttingDown = false;
  }

  // Health check methods
  async healthCheck(): Promise<{
    totalInstances: number;
    connectedInstances: number;
    disconnectedInstances: number;
    instances: Array<{
      id: string;
      tenantId: string;
      name: string;
      status: ConnectionStatus;
      lastActivity?: Date;
    }>;
  }> {
    const instances = this.getAllInstances();
    
    return {
      totalInstances: instances.length,
      connectedInstances: instances.filter(i => i.status === 'connected').length,
      disconnectedInstances: instances.filter(i => i.status === 'disconnected').length,
      instances: instances.map(i => {
        const instanceInfo: {
          id: string;
          tenantId: string;
          name: string;
          status: ConnectionStatus;
          lastActivity?: Date;
        } = {
          id: i.id,
          tenantId: i.tenantId,
          name: i.name,
          status: i.status
        };

        if (i.lastActivity !== undefined) {
          instanceInfo.lastActivity = i.lastActivity;
        }

        return instanceInfo;
      })
    };
  }

  // Cleanup inactive instances
  async cleanupInactiveInstances(maxInactiveHours = 24): Promise<void> {
    const cutoffTime = new Date(Date.now() - maxInactiveHours * 60 * 60 * 1000);
    const instancesToCleanup: string[] = [];

    for (const [instanceId, instance] of this.instances) {
      if (
        instance.status === 'disconnected' &&
        instance.lastActivity &&
        instance.lastActivity < cutoffTime
      ) {
        instancesToCleanup.push(instanceId);
      }
    }

    for (const instanceId of instancesToCleanup) {
      try {
        await this.deleteInstance(instanceId);
        logger.info(`Cleaned up inactive instance: ${instanceId}`);
      } catch (error) {
        logger.error(`Failed to cleanup instance ${instanceId}:`, error);
      }
    }
  }
}
