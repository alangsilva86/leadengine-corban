import { BaileysWhatsAppProvider, WhatsAppConfig, ConnectionStatus } from './baileys-provider';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

export interface WhatsAppInstance {
  id: string;
  tenantId: string;
  name: string;
  status: ConnectionStatus;
  provider: BaileysWhatsAppProvider;
  createdAt: Date;
  lastActivity?: Date;
}

export interface CreateInstanceRequest {
  tenantId: string;
  name: string;
  webhookUrl?: string;
}

export class WhatsAppInstanceManager extends EventEmitter {
  private instances = new Map<string, WhatsAppInstance>();
  private sessionsPath: string;

  constructor(sessionsPath = './sessions') {
    super();
    this.sessionsPath = sessionsPath;
    this.ensureSessionsDirectory();
  }

  private async ensureSessionsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create sessions directory:', error);
    }
  }

  async createInstance(request: CreateInstanceRequest): Promise<WhatsAppInstance> {
    const instanceId = this.generateInstanceId(request.tenantId);
    
    if (this.instances.has(instanceId)) {
      throw new Error(`Instance ${instanceId} already exists`);
    }

    const sessionPath = path.join(this.sessionsPath, instanceId);
    
    const config: WhatsAppConfig = {
      instanceId,
      sessionPath,
      webhookUrl: request.webhookUrl,
      qrCodeCallback: (qr) => this.handleQRCode(instanceId, qr),
      statusCallback: (status) => this.handleStatusChange(instanceId, status)
    };

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
      await instance.provider.disconnect();
      instance.status = 'disconnected';
      logger.info(`Instance ${instanceId} stopped`);
      this.emit('instance.stopped', instance);
    } catch (error) {
      logger.error(`Failed to stop instance ${instanceId}:`, error);
      throw error;
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

    // Remove session files
    try {
      const sessionPath = path.join(this.sessionsPath, instanceId);
      await fs.rm(sessionPath, { recursive: true, force: true });
    } catch (error) {
      logger.warn(`Failed to remove session files for ${instanceId}:`, error);
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
      this.emit('instance.connected', instance);
    });

    provider.on('disconnected', (error) => {
      instance.status = 'disconnected';
      this.emit('instance.disconnected', { instance, error });
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
      instances: instances.map(i => ({
        id: i.id,
        tenantId: i.tenantId,
        name: i.name,
        status: i.status,
        lastActivity: i.lastActivity
      }))
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
