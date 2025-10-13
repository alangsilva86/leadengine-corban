import { afterEach, describe, expect, it, vi } from 'vitest';

describe('WhatsAppBrokerClient HTTP transport configuration', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('reads broker settings exclusively from the WhatsApp config accessors', async () => {
    vi.resetModules();

    const configModule = await import('../../config/whatsapp');
    const getWhatsAppModeSpy = vi.spyOn(configModule, 'getWhatsAppMode').mockReturnValue('http');
    const getRawWhatsAppModeSpy = vi.spyOn(configModule, 'getRawWhatsAppMode').mockReturnValue('http');
    const getBrokerBaseUrlSpy = vi
      .spyOn(configModule, 'getBrokerBaseUrl')
      .mockReturnValue('https://mock-broker');
    const getBrokerApiKeySpy = vi
      .spyOn(configModule, 'getBrokerApiKey')
      .mockReturnValue('mock-api-key');
    const getBrokerTimeoutMsSpy = vi
      .spyOn(configModule, 'getBrokerTimeoutMs')
      .mockReturnValue(4321);
    const getBrokerWebhookUrlSpy = vi
      .spyOn(configModule, 'getBrokerWebhookUrl')
      .mockReturnValue('https://mock-webhook');
    const getWebhookVerifyTokenSpy = vi
      .spyOn(configModule, 'getWebhookVerifyToken')
      .mockReturnValue('verify-token');

    const fetchMock = vi.fn();

    vi.doMock('undici', async () => {
      const actual = await vi.importActual<typeof import('undici')>('undici');
      return {
        ...actual,
        fetch: fetchMock,
      };
    });

    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    const { Response } = await import('undici');
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            instances: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'inst-1' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ externalId: 'wamid-xyz', status: 'SENT' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

    // Trigger listInstances -> uses base URL, API key and timeout
    await whatsappBrokerClient.listInstances('tenant-1');
    // Trigger createInstance -> uses webhook URL + verify token
    await whatsappBrokerClient.createInstance({ tenantId: 'tenant-1', name: 'CRM', instanceId: 'inst-1' });
    // Trigger sendMessage -> exercises timeout getter during request
    await whatsappBrokerClient.sendMessage('inst-1', { to: '+5511999999999', type: 'text', content: 'Olá' });

    expect(getWhatsAppModeSpy).toHaveBeenCalled();
    expect(getRawWhatsAppModeSpy).toHaveBeenCalled();
    expect(getBrokerBaseUrlSpy).toHaveBeenCalled();
    expect(getBrokerApiKeySpy).toHaveBeenCalled();
    expect(getBrokerTimeoutMsSpy).toHaveBeenCalled();
    expect(getBrokerWebhookUrlSpy).toHaveBeenCalled();
    expect(getWebhookVerifyTokenSpy).toHaveBeenCalled();
  });
});
