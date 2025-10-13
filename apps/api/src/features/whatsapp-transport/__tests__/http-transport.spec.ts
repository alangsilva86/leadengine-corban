import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestInit } from 'undici';
import { ZodError } from 'zod';
import { HttpWhatsAppTransport } from '../http-transport';
import {
  WhatsAppBrokerError,
  WhatsAppBrokerNotConfiguredError,
  type WhatsAppBrokerResolvedConfig,
} from '../../../services/whatsapp-broker-client';
import * as brokerClient from '../../../services/whatsapp-broker-client';
import { logger } from '../../../config/logger';

const buildConfig = (): WhatsAppBrokerResolvedConfig => ({
  baseUrl: 'https://broker.test',
  apiKey: 'test-key',
  webhookUrl: 'https://webhook.test',
  verifyToken: 'verify-token',
  timeoutMs: 15_000,
});

const setupSpies = () => {
  const resolveConfig = vi
    .spyOn(brokerClient, 'resolveWhatsAppBrokerConfig')
    .mockReturnValue(buildConfig());
  const performRequest = vi.spyOn(brokerClient, 'performWhatsAppBrokerRequest');
  return { performRequest, resolveConfig };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HttpWhatsAppTransport', () => {
  it('dispatches text payloads via the direct endpoint with idempotency metadata', async () => {
    const { performRequest } = setupSpies();
    const responsePayload = {
      id: 'wamid-123',
      status: 'sent',
      timestamp: '2024-01-01T00:00:00.000Z',
      raw: { foo: 'bar' },
    } as Record<string, unknown>;
    performRequest.mockResolvedValueOnce(responsePayload);

    const transport = new HttpWhatsAppTransport();
    const result = await transport.sendMessage('instance-1', {
      to: '+5511988887777',
      content: 'Olá mundo',
      metadata: { idempotencyKey: 'key-42' },
    });

    expect(performRequest).toHaveBeenCalledTimes(1);
    const [path, init, options, config] = performRequest.mock.calls[0];
    expect(path).toBe('/instances/instance-1/send-text');
    expect(options).toEqual({ idempotencyKey: 'key-42' });
    expect(config).toMatchObject(buildConfig());

    const parsedBody = JSON.parse(String((init as RequestInit).body));
    expect(parsedBody).toMatchObject({
      sessionId: 'instance-1',
      instanceId: 'instance-1',
      to: '+5511988887777',
      type: 'text',
      text: 'Olá mundo',
      message: 'Olá mundo',
      metadata: { idempotencyKey: 'key-42' },
    });

    expect(result).toEqual({
      externalId: 'wamid-123',
      status: 'sent',
      timestamp: '2024-01-01T00:00:00.000Z',
      raw: { foo: 'bar' },
    });
  });

  it('logs structured direct dispatch metadata instead of legacy sidecar messaging', async () => {
    const { performRequest } = setupSpies();
    performRequest.mockResolvedValueOnce({
      id: 'wamid-log',
      status: 'sent',
      timestamp: '2024-02-02T02:02:02.000Z',
    } as Record<string, unknown>);

    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => logger);

    const transport = new HttpWhatsAppTransport();
    await transport.sendMessage(
      'instance-log',
      {
        to: '+5511999912121',
        content: 'Mensagens estruturadas',
      },
      { idempotencyKey: 'log-key' }
    );

    expect(infoSpy).toHaveBeenCalledWith(
      '🧭 [WhatsApp Broker] Selecionando rota direta para envio',
      expect.objectContaining({
        endpoint: '/instances/instance-log/send-text',
        hasMedia: false,
        idempotencyKey: 'log-key',
        instanceId: 'instance-log',
        mediaHasCaption: false,
        messageType: 'text',
        previewSnippet: 'Mensagens estruturadas',
        to: '+5511999912121',
      })
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '🎉 [WhatsApp Broker] Resposta recebida da rota direta',
      expect.objectContaining({
        endpoint: '/instances/instance-log/send-text',
        externalId: 'wamid-log',
        instanceId: 'instance-log',
        messageType: 'text',
        status: 'sent',
        to: '+5511999912121',
      })
    );
  });

  it('dispatches media payloads via the send-media endpoint nesting the descriptor', async () => {
    const { performRequest } = setupSpies();
    performRequest.mockResolvedValueOnce({ id: 'wamid-789', status: 'sent' } as Record<string, unknown>);

    const transport = new HttpWhatsAppTransport();
    await transport.sendMessage('instance-2', {
      to: '+5511999988877',
      type: 'image',
      content: 'Conteúdo ignorado',
      caption: 'olha a foto',
      mediaUrl: 'https://cdn.test/foto.jpg',
      mediaMimeType: 'image/jpeg',
      mediaFileName: 'foto.jpg',
    });

    expect(performRequest).toHaveBeenCalledTimes(1);
    const [path, init] = performRequest.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/instances/instance-2/send-media');

    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      sessionId: 'instance-2',
      instanceId: 'instance-2',
      type: 'image',
      caption: 'olha a foto',
      message: 'olha a foto',
      media: {
        url: 'https://cdn.test/foto.jpg',
        mimetype: 'image/jpeg',
        fileName: 'foto.jpg',
      },
    });
  });

  it('derives idempotency key from metadata when option is missing', async () => {
    const { performRequest } = setupSpies();
    performRequest.mockResolvedValueOnce({ id: 'wamid-456', status: 'sent' } as Record<string, unknown>);

    const transport = new HttpWhatsAppTransport();
    await transport.sendMessage('instance-1', {
      to: '+5511999999999',
      content: 'Teste',
      metadata: { idempotencyKey: ' meta-key ' },
    });

    const [, , options] = performRequest.mock.calls[0];
    expect(options).toEqual({ idempotencyKey: 'meta-key' });
  });

  it('requires media payloads for direct media routes', async () => {
    setupSpies();
    const transport = new HttpWhatsAppTransport();

    await expect(() =>
      transport.sendMessage('instance-1', {
        to: '+5511999999999',
        type: 'image',
        content: 'Imagem sem URL',
      })
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('wraps unexpected dispatch failures in WhatsAppBrokerError', async () => {
    const { performRequest } = setupSpies();
    performRequest.mockRejectedValueOnce(new Error('boom'));

    const transport = new HttpWhatsAppTransport();

    await expect(() =>
      transport.sendMessage('instance-1', {
        to: '+5511999999999',
        content: 'Olá',
      })
    ).rejects.toMatchObject({
      constructor: WhatsAppBrokerError,
      code: 'BROKER_ERROR',
    });
  });

  it('rethrows configuration errors when broker is not configured', async () => {
    vi.spyOn(brokerClient, 'resolveWhatsAppBrokerConfig').mockImplementation(() => {
      throw new WhatsAppBrokerNotConfiguredError('no config');
    });

    const transport = new HttpWhatsAppTransport();

    await expect(() =>
      transport.sendMessage('instance-1', {
        to: '+5511999999999',
        content: 'Olá',
      })
    ).rejects.toBeInstanceOf(WhatsAppBrokerNotConfiguredError);
  });

  it('converts unexpected configuration failures into WhatsAppBrokerNotConfiguredError', async () => {
    vi.spyOn(brokerClient, 'resolveWhatsAppBrokerConfig').mockImplementation(() => {
      throw new Error('env failure');
    });

    const transport = new HttpWhatsAppTransport();

    await expect(() =>
      transport.sendMessage('instance-1', {
        to: '+5511999999999',
        content: 'Olá',
      })
    ).rejects.toMatchObject({
      constructor: WhatsAppBrokerNotConfiguredError,
    });
  });

  it('delegates recipient checks to the HTTP broker', async () => {
    const { performRequest } = setupSpies();
    performRequest.mockResolvedValueOnce({ exists: true } as Record<string, unknown>);

    const transport = new HttpWhatsAppTransport();
    const result = await transport.checkRecipient({
      sessionId: 'session-1',
      to: '  +5511999888877  ',
    });

    expect(performRequest).toHaveBeenCalledWith(
      '/instances/session-1/exists',
      expect.objectContaining({ method: 'POST' }),
      undefined,
      buildConfig()
    );
    expect(result).toEqual({ exists: true });
  });

  it('fetches groups using the broker HTTP API', async () => {
    const { performRequest } = setupSpies();
    performRequest.mockResolvedValueOnce({ groups: [] } as Record<string, unknown>);

    const transport = new HttpWhatsAppTransport();
    await transport.getGroups({ sessionId: 'session-1' });

    expect(performRequest).toHaveBeenCalledWith(
      '/instances/session-1/groups',
      { method: 'GET' },
      undefined,
      buildConfig()
    );
  });

  it('creates polls computing selectable count from options', async () => {
    const { performRequest } = setupSpies();
    performRequest.mockResolvedValueOnce({
      id: 'poll-1',
      status: 'sent',
      ack: 'server',
      rate: { remaining: 10 },
    } as Record<string, unknown>);

    const transport = new HttpWhatsAppTransport();
    const poll = await transport.createPoll({
      sessionId: 'session-1',
      instanceId: 'inst-1',
      to: '+5511999888877',
      question: 'Qual opção prefere?',
      options: ['A', 'B', 'C'],
      allowMultipleAnswers: true,
    });

    const [, init] = performRequest.mock.calls[0];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      selectableCount: 3,
      options: ['A', 'B', 'C'],
    });
    expect(poll).toEqual({
      id: 'poll-1',
      status: 'sent',
      ack: 'server',
      rate: { remaining: 10 },
      raw: {
        id: 'poll-1',
        status: 'sent',
        ack: 'server',
        rate: { remaining: 10 },
      },
    });
  });
});
