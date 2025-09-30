import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
  type ConnectionState,
} from 'baileys';
import { Boom } from '@hapi/boom';
import type { MessageProvider } from '../types/message-provider';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface WhatsAppConfig {
  instanceId: string;
  sessionPath: string;
  webhookUrl?: string;
  qrCodeCallback?: (qr: string) => void;
  statusCallback?: (status: ConnectionStatus) => void;
}

export type ConnectionStatus = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'qr_required' 
  | 'error';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  timestamp: Date;
  mediaUrl?: string;
  mediaType?: string;
  quotedMessage?: string;
}

export class BaileysWhatsAppProvider extends EventEmitter implements MessageProvider {
  private socket: WASocket | null = null;
  private config: WhatsAppConfig;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: WhatsAppConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      logger.info(`Initializing WhatsApp instance: ${this.config.instanceId}`);
      
      const { state, saveCreds } = await useMultiFileAuthState(this.config.sessionPath);
      
      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: logger as any,
        browser: ['Ticketz LeadEngine', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: true,
      });

      this.setupEventHandlers(saveCreds);
      
    } catch (error) {
      logger.error('Failed to initialize WhatsApp provider:', error);
      this.setStatus('error');
      throw error;
    }
  }

  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

    // Connection updates
    this.socket.ev.on('connection.update', (update) => {
      this.handleConnectionUpdate(update);
    });

    // Credentials update
    this.socket.ev.on('creds.update', saveCreds);

    // Messages
    this.socket.ev.on('messages.upsert', (messageUpdate) => {
      this.handleIncomingMessages(messageUpdate);
    });

    // Message status updates
    this.socket.ev.on('messages.update', (messageUpdates) => {
      this.handleMessageUpdates(messageUpdates);
    });

    // Presence updates
    this.socket.ev.on('presence.update', (presenceUpdate) => {
      this.emit('presence.update', presenceUpdate);
    });
  }

  private handleConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('QR Code generated for WhatsApp connection');
      this.setStatus('qr_required');
      this.config.qrCodeCallback?.(qr);
      this.emit('qr', qr);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      
      logger.info('WhatsApp connection closed:', {
        shouldReconnect,
        statusCode: (lastDisconnect?.error as Boom)?.output?.statusCode,
        reason: lastDisconnect?.error?.message
      });

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.setStatus('connecting');
        setTimeout(() => this.initialize(), 3000);
      } else {
        this.setStatus('disconnected');
        this.emit('disconnected', lastDisconnect?.error);
      }
    } else if (connection === 'open') {
      logger.info('WhatsApp connection established successfully');
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      this.emit('connected');
    } else if (connection === 'connecting') {
      this.setStatus('connecting');
    }
  }

  private handleIncomingMessages(messageUpdate: { messages: WAMessage[], type: 'notify' | 'append' }): void {
    const { messages, type } = messageUpdate;

    if (type !== 'notify') return;

    for (const message of messages) {
      if (message.key.fromMe) continue; // Ignore own messages

      const whatsappMessage = this.parseMessage(message);
      if (whatsappMessage) {
        logger.info('Received WhatsApp message:', {
          id: whatsappMessage.id,
          from: whatsappMessage.from,
          type: whatsappMessage.type
        });

        this.emit('message', whatsappMessage);
      }
    }
  }

  private handleMessageUpdates(messageUpdates: any[]): void {
    for (const update of messageUpdates) {
      this.emit('message.update', {
        id: update.key.id,
        status: update.update?.status,
        timestamp: new Date()
      });
    }
  }

  private parseMessage(message: WAMessage): WhatsAppMessage | null {
    try {
      const messageContent = message.message;
      if (!messageContent) return null;

      const messageId = message.key.id!;
      const from = message.key.remoteJid!;
      const timestamp = new Date((message.messageTimestamp as number) * 1000);

      let content = '';
      let type: WhatsAppMessage['type'] = 'text';
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      // Text message
      if (messageContent.conversation) {
        content = messageContent.conversation;
        type = 'text';
      }
      // Extended text message
      else if (messageContent.extendedTextMessage) {
        content = messageContent.extendedTextMessage.text || '';
        type = 'text';
      }
      // Image message
      else if (messageContent.imageMessage) {
        content = messageContent.imageMessage.caption || '';
        type = 'image';
        mediaType = messageContent.imageMessage.mimetype ?? undefined;
      }
      // Audio message
      else if (messageContent.audioMessage) {
        content = '[Áudio]';
        type = 'audio';
        mediaType = messageContent.audioMessage.mimetype ?? undefined;
      }
      // Video message
      else if (messageContent.videoMessage) {
        content = messageContent.videoMessage.caption || '[Vídeo]';
        type = 'video';
        mediaType = messageContent.videoMessage.mimetype ?? undefined;
      }
      // Document message
      else if (messageContent.documentMessage) {
        content = messageContent.documentMessage.fileName || '[Documento]';
        type = 'document';
        mediaType = messageContent.documentMessage.mimetype ?? undefined;
      }

      return {
        id: messageId,
        from,
        to: this.socket?.user?.id || '',
        content,
        type,
        timestamp,
        mediaUrl,
        mediaType
      };
    } catch (error) {
      logger.error('Error parsing WhatsApp message:', error);
      return null;
    }
  }

  async sendMessage(
    _channel: string,
    to: string,
    content: string,
    _metadata?: Record<string, unknown>
  ): Promise<{ externalId: string; status: string }> {
    if (!this.socket || this.connectionStatus !== 'connected') {
      throw new Error('WhatsApp not connected');
    }

    try {
      const jid = this.formatJid(to);
      const sentMessage = await this.socket.sendMessage(jid, { text: content });

      logger.info('WhatsApp message sent:', {
        to: jid,
        messageId: sentMessage?.key?.id,
        content: content.substring(0, 100)
      });

      return {
        externalId: sentMessage?.key?.id || '',
        status: 'sent'
      };
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  async sendMedia(
    _channel: string,
    to: string,
    mediaUrl: string,
    caption?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ externalId: string; status: string }> {
    if (!this.socket || this.connectionStatus !== 'connected') {
      throw new Error('WhatsApp not connected');
    }

    try {
      const jid = this.formatJid(to);
      
      // Determine media type from URL or metadata
      const mediaType = metadata?.mediaType as string || 'image';
      
      let messageContent: any;
      
      switch (mediaType) {
        case 'image':
          messageContent = {
            image: { url: mediaUrl },
            caption
          };
          break;
        case 'video':
          messageContent = {
            video: { url: mediaUrl },
            caption
          };
          break;
        case 'audio':
          messageContent = {
            audio: { url: mediaUrl },
            mimetype: 'audio/mp4'
          };
          break;
        case 'document':
          messageContent = {
            document: { url: mediaUrl },
            fileName: metadata?.fileName as string || 'document',
            mimetype: metadata?.mimetype as string || 'application/octet-stream'
          };
          break;
        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }

      const sentMessage = await this.socket.sendMessage(jid, messageContent);

      logger.info('WhatsApp media sent:', {
        to: jid,
        messageId: sentMessage?.key?.id,
        mediaType,
        mediaUrl
      });

      return {
        externalId: sentMessage?.key?.id || '',
        status: 'sent'
      };
    } catch (error) {
      logger.error('Error sending WhatsApp media:', error);
      throw error;
    }
  }

  async markAsRead(messageId: string, from: string): Promise<void> {
    if (!this.socket || this.connectionStatus !== 'connected') {
      throw new Error('WhatsApp not connected');
    }

    try {
      const jid = this.formatJid(from);
      await this.socket.readMessages([{ remoteJid: jid, id: messageId, participant: undefined }]);
      
      logger.info('Message marked as read:', { messageId, from: jid });
    } catch (error) {
      logger.error('Error marking message as read:', error);
      throw error;
    }
  }

  async getProfilePicture(jid: string): Promise<string | null> {
    if (!this.socket || this.connectionStatus !== 'connected') {
      return null;
    }

    try {
      const profilePicUrl = await this.socket.profilePictureUrl(this.formatJid(jid), 'image');
      return profilePicUrl ?? null;
    } catch (error) {
      logger.warn('Could not get profile picture:', error);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      await this.socket.logout();
      this.socket = null;
    }
    this.setStatus('disconnected');
    logger.info('WhatsApp disconnected');
  }

  private formatJid(number: string): string {
    // Remove all non-numeric characters
    const cleanNumber = number.replace(/\D/g, '');
    
    // Add country code if not present (assuming Brazil +55)
    let formattedNumber = cleanNumber;
    if (!formattedNumber.startsWith('55') && formattedNumber.length === 11) {
      formattedNumber = '55' + formattedNumber;
    }
    
    return formattedNumber + '@s.whatsapp.net';
  }

  private setStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.config.statusCallback?.(status);
    this.emit('status', status);
  }

  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }
}
