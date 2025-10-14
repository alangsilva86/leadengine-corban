import { test, expect, request as playwrightRequest } from '@playwright/test';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { URL } from 'node:url';

type StubInstance = {
  id: string;
  name: string;
  createdAt: string;
};

type StubAllocation = {
  allocationId: string;
  leadId: string;
  tenantId: string;
  campaignId: string;
  campaignName: string;
  agreementId: string;
  instanceId: string;
  status: string;
  receivedAt: string;
  updatedAt: string;
  fullName: string;
  document: string;
  registrations: string[];
  tags: string[];
  phone?: string;
  payload: {
    lastInboundMessage: {
      id: string;
      text: string;
      receivedAt: string;
    };
  };
};

interface BrokerStubState {
  instances: Map<string, StubInstance>;
  allocations: Map<string, StubAllocation>;
}

export const createHtmlPage = () => String.raw`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Inbox Playwright • Broker Stub</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #f5f5f5; }
      main { max-width: 720px; margin: 0 auto; background: white; padding: 24px; border-radius: 16px; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12); }
      h1 { font-size: 1.5rem; margin-bottom: 16px; }
      p.status { color: #334155; margin-bottom: 16px; }
      ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
      li { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), rgba(255, 255, 255, 0.95)); box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08); display: flex; flex-direction: column; gap: 4px; }
      li strong { color: #0f172a; font-size: 1rem; }
      li span.message { color: #1e293b; }
      li span.meta { color: #64748b; font-size: 0.85rem; }
      .empty-state { text-align: center; color: #475569; padding: 32px 16px; border: 1px dashed #cbd5f5; border-radius: 12px; background: rgba(248, 250, 252, 0.9); }
      code { background: #0f172a; color: #38bdf8; padding: 2px 6px; border-radius: 6px; font-size: 0.85rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Inbox por instância</h1>
      <p class="status" id="status">Aguardando instância…</p>
      <div id="context"></div>
      <ul id="messages" data-testid="inbox-list"></ul>
    </main>
    <script>
      const boot = () => {
        window.__stubInitialized = true;
        console.log('Stub • script iniciado');

        const params = new URLSearchParams(window.location.search);
        const instanceId = params.get('instanceId') || 'default';
        const statusEl = document.getElementById('status');
        const listEl = document.getElementById('messages');
        const contextEl = document.getElementById('context');
        contextEl.setAttribute('data-testid', 'context-info');
        contextEl.innerHTML = \`<p>Monitorando instância <code>\${instanceId}</code></p>\`;

      const renderEmpty = () => {
        listEl.innerHTML = '';
        const empty = document.createElement('li');
        empty.className = 'empty-state';
        empty.setAttribute('data-testid', 'empty-state');
        empty.textContent = 'Nenhum lead disponível para esta instância.';
        listEl.appendChild(empty);
      };

      const renderAllocations = (items) => {
        listEl.innerHTML = '';
        if (!Array.isArray(items) || items.length === 0) {
          renderEmpty();
          return;
        }

        items.forEach((item) => {
          const entry = document.createElement('li');
          entry.setAttribute('data-testid', 'inbox-message');

          const heading = document.createElement('strong');
          heading.textContent = item.fullName || 'Contato sem nome';
          entry.appendChild(heading);

          const message = document.createElement('span');
          message.className = 'message';
          const text = item?.payload?.lastInboundMessage?.text || '(sem conteúdo)';
          message.textContent = text;
          entry.appendChild(message);

          const meta = document.createElement('span');
          meta.className = 'meta';
          const receivedAt = item?.payload?.lastInboundMessage?.receivedAt;
          meta.textContent = receivedAt ? new Date(receivedAt).toLocaleString('pt-BR') : 'Sem horário conhecido';
          entry.appendChild(meta);

          listEl.appendChild(entry);
        });
      };

      const fetchAllocations = async () => {
        statusEl.textContent = 'Sincronizando mensagens…';
        try {
          const response = await fetch(\`/api/lead-engine/allocations?instanceId=\${encodeURIComponent(instanceId)}\`);
          if (!response.ok) {
            throw new Error(\`Falha HTTP \${response.status}\`);
          }

          const payload = await response.json();
          const items = Array.isArray(payload?.data) ? payload.data : [];
          renderAllocations(items);
          statusEl.textContent = \`Atualizado às \${new Date().toLocaleTimeString('pt-BR')}\`;
        } catch (error) {
          console.error('Falha ao carregar inbox', error);
          statusEl.textContent = 'Erro ao sincronizar mensagens.';
        }
      };

        renderEmpty();
        fetchAllocations();
        setInterval(fetchAllocations, 1000);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
      } else {
        boot();
      }
    </script>
  </body>
</html>`;

class BrokerStubServer {
  private server: http.Server;
  private state: BrokerStubState;
  public baseUrl!: string;

  constructor() {
    this.state = {
      instances: new Map(),
      allocations: new Map(),
    };

    this.server = http.createServer(async (req, res) => {
      if (!req.url || !req.method) {
        res.statusCode = 400;
        res.end('Bad request');
        return;
      }

      const requestUrl = new URL(req.url, 'http://localhost');

      if (req.method === 'GET' && requestUrl.pathname === '/') {
        const html = createHtmlPage();
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (req.method === 'POST' && requestUrl.pathname === '/broker/instances') {
        try {
          const body = await this.readJson(req);
          const providedId = typeof body?.id === 'string' ? body.id.trim() : '';
          const instanceId = providedId || `instance-${randomUUID().slice(0, 8)}`;
          const name = typeof body?.name === 'string' && body.name.trim().length > 0 ? body.name.trim() : instanceId;

          const instance: StubInstance = {
            id: instanceId,
            name,
            createdAt: new Date().toISOString(),
          };

          this.state.instances.set(instanceId, instance);
          this.state.allocations.delete(instanceId);

          this.sendJson(res, 201, { data: instance });
        } catch (error) {
          this.handleError(res, error);
        }
        return;
      }

      if (req.method === 'POST' && requestUrl.pathname.startsWith('/broker/instances/')) {
        const segments = requestUrl.pathname.split('/').filter(Boolean);
        if (segments.length === 4 && segments[3] === 'messages') {
          const instanceId = segments[2];
          const instance = this.state.instances.get(instanceId);
          if (!instance) {
            this.sendJson(res, 404, { error: { message: 'Instance not found' } });
            return;
          }

          try {
            const body = await this.readJson(req);
            const messageId = typeof body?.messageId === 'string' && body.messageId.trim().length > 0
              ? body.messageId.trim()
              : `wamid-${randomUUID()}`;
            const text = typeof body?.text === 'string' && body.text.trim().length > 0
              ? body.text.trim()
              : 'Mensagem sem conteúdo';
            const phone = typeof body?.phone === 'string' ? body.phone : undefined;
            const contactName = typeof body?.contactName === 'string' && body.contactName.trim().length > 0
              ? body.contactName.trim()
              : 'Contato Playwright';
            const document = typeof body?.document === 'string' && body.document.trim().length > 0
              ? body.document.trim()
              : '00000000000';
            const receivedAt = new Date().toISOString();

            const allocation = this.state.allocations.get(instanceId) ?? {
              allocationId: `alloc-${instanceId}`,
              leadId: `lead-${instanceId}`,
              tenantId: 'tenant-playwright',
              campaignId: `campaign-${instanceId}`,
              campaignName: 'WhatsApp • Inbound (Stub)',
              agreementId: `agreement-${instanceId}`,
              instanceId,
              status: 'allocated',
              receivedAt,
              updatedAt: receivedAt,
              fullName: contactName,
              document,
              registrations: [],
              tags: [],
              payload: {
                lastInboundMessage: {
                  id: messageId,
                  text,
                  receivedAt,
                },
              },
            } as StubAllocation;

            allocation.fullName = contactName;
            allocation.document = document;
            allocation.phone = phone;
            allocation.updatedAt = receivedAt;
            if (!allocation.receivedAt) {
              allocation.receivedAt = receivedAt;
            }
            allocation.payload = {
              lastInboundMessage: {
                id: messageId,
                text,
                receivedAt,
              },
            };

            this.state.allocations.set(instanceId, allocation);

            this.sendJson(res, 202, {
              status: 'queued',
              data: {
                instanceId,
                messageId,
                receivedAt,
              },
            });
          } catch (error) {
            this.handleError(res, error);
          }
          return;
        }
      }

      if (req.method === 'GET' && requestUrl.pathname === '/api/lead-engine/allocations') {
        const instanceId = requestUrl.searchParams.get('instanceId');
        const allocations: StubAllocation[] = [];
        if (instanceId) {
          const allocation = this.state.allocations.get(instanceId);
          if (allocation) {
            allocations.push(allocation);
          }
        } else {
          allocations.push(...this.state.allocations.values());
        }

        this.sendJson(res, 200, {
          data: allocations,
          meta: { total: allocations.length },
        });
        return;
      }

      this.sendJson(res, 404, { error: { message: 'Not found' } });
    });
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = this.server.address() as AddressInfo;
    this.baseUrl = `http://127.0.0.1:${address.port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private async readJson(req: http.IncomingMessage): Promise<unknown> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    if (chunks.length === 0) {
      return {};
    }
    const buffer = Buffer.concat(chunks);
    try {
      return JSON.parse(buffer.toString('utf-8'));
    } catch (error) {
      throw new Error('Invalid JSON payload');
    }
  }

  private sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
    const payload = JSON.stringify(body);
    res.writeHead(statusCode, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(payload),
      'cache-control': 'no-store',
    });
    res.end(payload);
  }

  private handleError(res: http.ServerResponse, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.sendJson(res, 400, {
      error: {
        message,
      },
    });
  }
}

if (process.env.PLAYWRIGHT_DISABLE_TESTS !== '1') {
  test.describe('WhatsApp inbox • broker stub', () => {
    test('exibe mensagens recentes por instanceId', async ({ request }) => {
      const stub = new BrokerStubServer();
      await stub.start();

      test.info().annotations.push({ type: 'stub-base-url', description: stub.baseUrl });

      const apiContext = await playwrightRequest.newContext({ baseURL: stub.baseUrl });

    const instanceId = `inst-${randomUUID().slice(0, 8)}`;
    const createResponse = await apiContext.post('/broker/instances', {
      data: {
        id: instanceId,
        name: `Playwright Instance ${instanceId}`,
      },
    });
    expect(createResponse.status()).toBe(201);

      const initialInbox = await apiContext.get(`/api/lead-engine/allocations?instanceId=${instanceId}`);
      expect(initialInbox.status()).toBe(200);
      const initialPayload = await initialInbox.json();
      expect(initialPayload?.data ?? []).toHaveLength(0);

    const messageId = `wamid-${randomUUID()}`;
    const messageText = `Mensagem Playwright ${new Date().toISOString()}`;

      const enqueueResponse = await apiContext.post(`/broker/instances/${instanceId}/messages`, {
      data: {
        messageId,
        text: messageText,
        phone: '+5511999999999',
        contactName: 'Playwright QA Bot',
      },
    });
    expect(enqueueResponse.status()).toBe(202);

    const payload = await enqueueResponse.json();
    expect(payload?.data?.messageId).toBe(messageId);

      const inboxResponse = await apiContext.get(`/api/lead-engine/allocations?instanceId=${instanceId}`);
      expect(inboxResponse.status()).toBe(200);
      const inboxPayload = await inboxResponse.json();
      const allocation = inboxPayload?.data?.[0];
      expect(allocation?.instanceId).toBe(instanceId);
      expect(allocation?.payload?.lastInboundMessage?.id).toBe(messageId);
      expect(allocation?.payload?.lastInboundMessage?.text).toBe(messageText);

      await apiContext.dispose();
      await stub.stop();
    });
  });
}
