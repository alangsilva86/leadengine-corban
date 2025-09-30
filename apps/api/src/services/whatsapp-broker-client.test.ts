import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalBrokerUrl = process.env.WHATSAPP_BROKER_URL;
const originalBrokerKey = process.env.WHATSAPP_BROKER_API_KEY;

describe('WhatsAppBrokerClient sendMessage', () => {
  const loadClient = async () => {
    const module = await import('./whatsapp-broker-client');
    return module.whatsappBrokerClient;
  };

  const mockRequest = (client: unknown) =>
    vi
      .spyOn(client as unknown as { request: (path: string, init: unknown) => Promise<unknown> }, 'request')
      .mockResolvedValue({ id: '123', status: 'sent' });

  const restoreEnv = () => {
    if (originalBrokerUrl === undefined) {
      delete process.env.WHATSAPP_BROKER_URL;
    } else {
      process.env.WHATSAPP_BROKER_URL = originalBrokerUrl;
    }

    if (originalBrokerKey === undefined) {
      delete process.env.WHATSAPP_BROKER_API_KEY;
    } else {
      process.env.WHATSAPP_BROKER_API_KEY = originalBrokerKey;
    }
  };

  beforeEach(() => {
    vi.resetModules();
    process.env.WHATSAPP_BROKER_URL = 'https://broker.example';
    process.env.WHATSAPP_BROKER_API_KEY = 'secret';
  });

  afterEach(() => {
    vi.resetAllMocks();
    restoreEnv();
  });

  it('sends text messages', async () => {
    const client = await loadClient();
    const requestSpy = mockRequest(client);

    await client.sendMessage('instance-1', {
      to: '5511999999999',
      content: 'Hello world',
      type: 'TEXT',
    });

    expect(requestSpy).toHaveBeenCalledTimes(1);
    const [endpoint, init] = requestSpy.mock.calls[0];
    expect(endpoint).toBe('/instances/instance-1/send-text');
    const body = JSON.parse((init as { body: string }).body);
    expect(body).toEqual({ to: '5511999999999', message: 'Hello world' });
  });

  it('sends image messages with caption', async () => {
    const client = await loadClient();
    const requestSpy = mockRequest(client);

    await client.sendMessage('instance-2', {
      to: '5511888888888',
      content: 'Check this image',
      type: 'image',
      mediaUrl: 'https://cdn.example.com/image.jpg',
      caption: 'Custom caption',
    });

    const [endpoint, init] = requestSpy.mock.calls[0];
    expect(endpoint).toBe('/instances/instance-2/send-image');
    const body = JSON.parse((init as { body: string }).body);
    expect(body).toEqual({
      to: '5511888888888',
      url: 'https://cdn.example.com/image.jpg',
      caption: 'Custom caption',
    });
  });

  it('sends audio messages with mimetype and ptt flag', async () => {
    const client = await loadClient();
    const requestSpy = mockRequest(client);

    await client.sendMessage('instance-3', {
      to: '5511777777777',
      content: 'Audio note',
      type: 'audio',
      mediaUrl: 'https://cdn.example.com/audio.ogg',
      mimeType: 'audio/ogg',
      ptt: true,
    });

    const [endpoint, init] = requestSpy.mock.calls[0];
    expect(endpoint).toBe('/instances/instance-3/send-audio');
    const body = JSON.parse((init as { body: string }).body);
    expect(body).toEqual({
      to: '5511777777777',
      url: 'https://cdn.example.com/audio.ogg',
      mimetype: 'audio/ogg',
      ptt: true,
    });
  });

  it('sends video messages with caption and mimetype', async () => {
    const client = await loadClient();
    const requestSpy = mockRequest(client);

    await client.sendMessage('instance-4', {
      to: '5511666666666',
      content: 'Video clip',
      type: 'VIDEO',
      mediaUrl: 'https://cdn.example.com/video.mp4',
      caption: 'Watch this',
      mimeType: 'video/mp4',
    });

    const [endpoint, init] = requestSpy.mock.calls[0];
    expect(endpoint).toBe('/instances/instance-4/send-video');
    const body = JSON.parse((init as { body: string }).body);
    expect(body).toEqual({
      to: '5511666666666',
      url: 'https://cdn.example.com/video.mp4',
      caption: 'Watch this',
      mimetype: 'video/mp4',
    });
  });

  it('sends document messages with filename', async () => {
    const client = await loadClient();
    const requestSpy = mockRequest(client);

    await client.sendMessage('instance-5', {
      to: '5511555555555',
      content: 'See attached document',
      type: 'document',
      mediaUrl: 'https://cdn.example.com/report.pdf',
      mimeType: 'application/pdf',
      fileName: 'report.pdf',
    });

    const [endpoint, init] = requestSpy.mock.calls[0];
    expect(endpoint).toBe('/instances/instance-5/send-document');
    const body = JSON.parse((init as { body: string }).body);
    expect(body).toEqual({
      to: '5511555555555',
      url: 'https://cdn.example.com/report.pdf',
      caption: 'See attached document',
      fileName: 'report.pdf',
      mimetype: 'application/pdf',
    });
  });

  it('sends location messages using coordinates', async () => {
    const client = await loadClient();
    const requestSpy = mockRequest(client);

    await client.sendMessage('instance-6', {
      to: '5511444444444',
      content: 'Office location',
      type: 'location',
      location: {
        latitude: -23.561684,
        longitude: -46.625378,
        name: 'Headquarters',
        address: 'Av. Paulista, 1000',
      },
    });

    const [endpoint, init] = requestSpy.mock.calls[0];
    expect(endpoint).toBe('/instances/instance-6/send-location');
    const body = JSON.parse((init as { body: string }).body);
    expect(body).toEqual({
      to: '5511444444444',
      latitude: -23.561684,
      longitude: -46.625378,
      name: 'Headquarters',
      address: 'Av. Paulista, 1000',
    });
  });

  it('sends contact messages with vcard data', async () => {
    const client = await loadClient();
    const requestSpy = mockRequest(client);

    await client.sendMessage('instance-7', {
      to: '5511333333333',
      content: 'Contact info',
      type: 'contact',
      contact: {
        displayName: 'Support',
        vcard: 'BEGIN:VCARD\nFN:Support\nTEL;TYPE=CELL:+5511333333333\nEND:VCARD',
      },
    });

    const [endpoint, init] = requestSpy.mock.calls[0];
    expect(endpoint).toBe('/instances/instance-7/send-contact');
    const body = JSON.parse((init as { body: string }).body);
    expect(body).toEqual({
      to: '5511333333333',
      contact: {
        displayName: 'Support',
        vcard: 'BEGIN:VCARD\nFN:Support\nTEL;TYPE=CELL:+5511333333333\nEND:VCARD',
      },
    });
  });

  it('sends template messages with namespace and components', async () => {
    const client = await loadClient();
    const requestSpy = mockRequest(client);

    await client.sendMessage('instance-8', {
      to: '5511222222222',
      content: 'Template trigger',
      type: 'template',
      template: {
        name: 'order_update',
        namespace: 'ecommerce',
        languageCode: 'pt_BR',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: '12345' }],
          },
        ],
      },
    });

    const [endpoint, init] = requestSpy.mock.calls[0];
    expect(endpoint).toBe('/instances/instance-8/send-template');
    const body = JSON.parse((init as { body: string }).body);
    expect(body).toEqual({
      to: '5511222222222',
      namespace: 'ecommerce',
      name: 'order_update',
      language: 'pt_BR',
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: '12345' }],
        },
      ],
    });
  });

  it('validates required media for audio messages', async () => {
    const client = await loadClient();
    const requestSpy = mockRequest(client);

    await expect(
      client.sendMessage('instance-9', {
        to: '5511111111111',
        content: 'Missing media',
        type: 'audio',
      } as unknown as Parameters<typeof client.sendMessage>[1])
    ).rejects.toThrow('Media URL is required for audio messages');

    expect(requestSpy).not.toHaveBeenCalled();
  });
});
