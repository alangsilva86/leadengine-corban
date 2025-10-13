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
