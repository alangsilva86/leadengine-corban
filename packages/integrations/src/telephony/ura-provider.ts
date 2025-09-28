import { EventEmitter } from 'events';
import type { MessageProvider } from '../types/message-provider';
import { logger } from '../utils/logger';
import axios, { AxiosInstance } from 'axios';

export interface URAConfig {
  apiUrl: string;
  apiKey: string;
  webhookUrl?: string;
  timeout?: number;
}

export interface URACall {
  id: string;
  from: string;
  to: string;
  status: 'ringing' | 'answered' | 'busy' | 'failed' | 'completed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  recording?: string;
  metadata?: Record<string, unknown>;
}

export interface URAFlow {
  id: string;
  name: string;
  steps: URAStep[];
  isActive: boolean;
}

export interface URAStep {
  id: string;
  type: 'message' | 'menu' | 'input' | 'transfer' | 'hangup';
  content: string;
  options?: URAMenuOption[];
  nextStep?: string;
  conditions?: URACondition[];
}

export interface URAMenuOption {
  key: string;
  label: string;
  nextStep: string;
}

export interface URACondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less';
  value: string;
  nextStep: string;
}

export interface CallRequest {
  to: string;
  flowId?: string;
  variables?: Record<string, string>;
  scheduledAt?: Date;
}

export class URAProvider extends EventEmitter implements MessageProvider {
  private config: URAConfig;
  private httpClient: AxiosInstance;
  private activeCalls = new Map<string, URACall>();

  constructor(config: URAConfig) {
    super();
    this.config = config;
    
    this.httpClient = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.info('URA API Request:', {
          method: config.method,
          url: config.url,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('URA API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        logger.info('URA API Response:', {
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('URA API Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  async sendMessage(
    _channel: string,
    to: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<{ externalId: string; status: string }> {
    try {
      const response = await this.httpClient.post('/calls/text-to-speech', {
        to,
        message: content,
        voice: metadata?.voice || 'default',
        language: metadata?.language || 'pt-BR'
      });

      return {
        externalId: response.data.callId,
        status: 'initiated'
      };
    } catch (error: unknown) {
      logger.error('Failed to send URA message:', error);
      throw error;
    }
  }

  async sendMedia(
    _channel: string,
    to: string,
    mediaUrl: string,
    caption?: string,
    _metadata?: Record<string, unknown>
  ): Promise<{ externalId: string; status: string }> {
    try {
      const response = await this.httpClient.post('/calls/play-audio', {
        to,
        audioUrl: mediaUrl,
        caption
      });

      return {
        externalId: response.data.callId,
        status: 'initiated'
      };
    } catch (error: unknown) {
      logger.error('Failed to send URA media:', error);
      throw error;
    }
  }

  async makeCall(request: CallRequest): Promise<URACall> {
    try {
      const response = await this.httpClient.post('/calls', {
        to: request.to,
        flowId: request.flowId,
        variables: request.variables,
        scheduledAt: request.scheduledAt?.toISOString(),
        webhookUrl: this.config.webhookUrl
      });

      const call: URACall = {
        id: response.data.callId,
        from: response.data.from,
        to: request.to,
        status: 'ringing',
        startTime: new Date(),
        metadata: request.variables
      };

      this.activeCalls.set(call.id, call);
      this.emit('call.initiated', call);

      return call;
    } catch (error: unknown) {
      logger.error('Failed to make URA call:', error);
      throw error;
    }
  }

  async getCall(callId: string): Promise<URACall | null> {
    try {
      const response = await this.httpClient.get(`/calls/${callId}`);
      
      const call: URACall = {
        id: response.data.id,
        from: response.data.from,
        to: response.data.to,
        status: response.data.status,
        startTime: new Date(response.data.startTime),
        endTime: response.data.endTime ? new Date(response.data.endTime) : undefined,
        duration: response.data.duration,
        recording: response.data.recording,
        metadata: response.data.metadata
      };

      this.activeCalls.set(callId, call);
      return call;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get URA call:', error);
      throw error;
    }
  }

  async hangupCall(callId: string): Promise<void> {
    try {
      await this.httpClient.post(`/calls/${callId}/hangup`);
      
      const call = this.activeCalls.get(callId);
      if (call) {
        call.status = 'completed';
        call.endTime = new Date();
        this.emit('call.ended', call);
      }
    } catch (error: unknown) {
      logger.error('Failed to hangup URA call:', error);
      throw error;
    }
  }

  async transferCall(callId: string, to: string): Promise<void> {
    try {
      await this.httpClient.post(`/calls/${callId}/transfer`, { to });
      
      const call = this.activeCalls.get(callId);
      if (call) {
        this.emit('call.transferred', { call, to });
      }
    } catch (error: unknown) {
      logger.error('Failed to transfer URA call:', error);
      throw error;
    }
  }

  // Flow management
  async createFlow(flow: Omit<URAFlow, 'id'>): Promise<URAFlow> {
    try {
      const response = await this.httpClient.post('/flows', flow);
      return response.data;
    } catch (error: unknown) {
      logger.error('Failed to create URA flow:', error);
      throw error;
    }
  }

  async updateFlow(flowId: string, flow: Partial<URAFlow>): Promise<URAFlow> {
    try {
      const response = await this.httpClient.put(`/flows/${flowId}`, flow);
      return response.data;
    } catch (error: unknown) {
      logger.error('Failed to update URA flow:', error);
      throw error;
    }
  }

  async deleteFlow(flowId: string): Promise<void> {
    try {
      await this.httpClient.delete(`/flows/${flowId}`);
    } catch (error: unknown) {
      logger.error('Failed to delete URA flow:', error);
      throw error;
    }
  }

  async getFlows(): Promise<URAFlow[]> {
    try {
      const response = await this.httpClient.get('/flows');
      return response.data;
    } catch (error: unknown) {
      logger.error('Failed to get URA flows:', error);
      throw error;
    }
  }

  async getFlow(flowId: string): Promise<URAFlow | null> {
    try {
      const response = await this.httpClient.get(`/flows/${flowId}`);
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get URA flow:', error);
      throw error;
    }
  }

  // Webhook handlers
  handleWebhook(payload: any): void {
    const { event, data } = payload;

    switch (event) {
      case 'call.answered':
        this.handleCallAnswered(data);
        break;
      case 'call.ended':
        this.handleCallEnded(data);
        break;
      case 'call.failed':
        this.handleCallFailed(data);
        break;
      case 'dtmf.received':
        this.handleDTMFReceived(data);
        break;
      case 'speech.recognized':
        this.handleSpeechRecognized(data);
        break;
      default:
        logger.warn('Unknown URA webhook event:', event);
    }
  }

  private handleCallAnswered(data: any): void {
    const call = this.activeCalls.get(data.callId);
    if (call) {
      call.status = 'answered';
      this.emit('call.answered', call);
    }
  }

  private handleCallEnded(data: any): void {
    const call = this.activeCalls.get(data.callId);
    if (call) {
      call.status = 'completed';
      call.endTime = new Date(data.endTime);
      call.duration = data.duration;
      call.recording = data.recording;
      
      this.emit('call.ended', call);
      this.activeCalls.delete(data.callId);
    }
  }

  private handleCallFailed(data: any): void {
    const call = this.activeCalls.get(data.callId);
    if (call) {
      call.status = 'failed';
      call.endTime = new Date();
      
      this.emit('call.failed', { call, reason: data.reason });
      this.activeCalls.delete(data.callId);
    }
  }

  private handleDTMFReceived(data: any): void {
    this.emit('dtmf.received', {
      callId: data.callId,
      digit: data.digit,
      timestamp: new Date(data.timestamp)
    });
  }

  private handleSpeechRecognized(data: any): void {
    this.emit('speech.recognized', {
      callId: data.callId,
      text: data.text,
      confidence: data.confidence,
      timestamp: new Date(data.timestamp)
    });
  }

  // Statistics and monitoring
  async getCallStatistics(startDate: Date, endDate: Date): Promise<{
    totalCalls: number;
    answeredCalls: number;
    failedCalls: number;
    averageDuration: number;
    answerRate: number;
  }> {
    try {
      const response = await this.httpClient.get('/statistics/calls', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
      
      return response.data;
    } catch (error: unknown) {
      logger.error('Failed to get call statistics:', error);
      throw error;
    }
  }

  getActiveCalls(): URACall[] {
    return Array.from(this.activeCalls.values());
  }

  getActiveCallsCount(): number {
    return this.activeCalls.size;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      const response = await this.httpClient.get('/health');
      return {
        status: response.data.status,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('URA health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date()
      };
    }
  }
}
