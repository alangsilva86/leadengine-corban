import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { io } from 'socket.io-client';

const api = process.env.CORBAN_ACCEPTANCE_API_URL ?? 'http://127.0.0.1:4000';
const web = process.env.CORBAN_ACCEPTANCE_WEB_URL ?? 'http://127.0.0.1:5173';
const webhookKey = process.env.CORBAN_ACCEPTANCE_WEBHOOK_KEY ?? '';
const webhookSecret = process.env.CORBAN_ACCEPTANCE_WEBHOOK_SECRET ?? '';
const enabled = process.env.CORBAN_ACCEPTANCE_ENABLED === '1';
const localOnly = (value: string) => ['127.0.0.1', 'localhost'].includes(new URL(value).hostname);

test.describe('Corban com API e PostgreSQL', () => {
  test.skip(!enabled || !localOnly(api) || !localOnly(web), 'Requer ambiente local descartável com seed.');

  const login = async (request: APIRequestContext, email = 'admin@ticketz.com', tenantSlug = 'demo-tenant', password = 'admin123') => {
    const response = await request.post(`${api}/api/auth/login`, { data: { email, tenantSlug, password } });
    expect(response.status()).toBe(200);
    const { data } = await response.json();
    return { headers: { authorization: `Bearer ${data.token.accessToken}` }, token: data.token };
  };

  test('isola organizações, valida conexão e rotaciona a sessão', async ({ request }) => {
    const session = await login(request);
    const organizationB = await login(request, 'admin@acme.test', 'acme-tenant');
    const { data } = await (await request.get(`${api}/api/contacts`, { headers: session.headers })).json();
    const contactId = (Array.isArray(data) ? data : data.items)[0].id;
    expect((await request.get(`${api}/api/contacts/${contactId}`, { headers: organizationB.headers })).status()).toBe(404);
    expect((await request.post(`${api}/api/auth/register`, { data: {} })).status()).toBe(403);

    for (const token of [undefined, session.token.accessToken]) {
      const socket = io(api, { transports: ['websocket'], reconnection: false, auth: { token }, timeout: 4000 });
      try {
        const connected = await new Promise<boolean>(resolve => {
          socket.once('connect', () => resolve(true));
          socket.once('connect_error', () => resolve(false));
        });
        expect(connected).toBe(Boolean(token));
        if (!connected) continue;
        const ack = await socket.timeout(4000).emitWithAck('join-tenant', 'acme-tenant');
        expect(ack).toMatchObject({ ok: false });
      } finally {
        socket.disconnect();
      }
    }

    const refreshData = { refreshToken: session.token.refreshToken };
    const replacement = await request.post(`${api}/api/auth/token/refresh`, { data: refreshData });
    expect(replacement.status()).toBe(200);
    expect((await request.post(`${api}/api/auth/token/refresh`, { data: refreshData })).status()).toBe(401);
    expect((await request.post(`${api}/api/auth/logout`, { headers: session.headers })).status()).toBe(204);
    expect((await request.get(`${api}/api/auth/me`, { headers: session.headers })).status()).toBe(401);
  });

  test('arquiva fila sem perder ticket e protege nota privada', async ({ request }) => {
    const admin = await login(request);
    const agent = await login(request, 'agente@ticketz.com', 'demo-tenant', 'agent123');
    const suffix = randomUUID().slice(0, 8);
    const newQueue = await request.post(`${api}/api/queues`, { headers: admin.headers, data: { name: `Fila QA ${suffix}` } });
    expect(newQueue.status()).toBe(201);
    const queue = (await newQueue.json()).data;
    const newContact = await request.post(`${api}/api/contacts`, {
      headers: admin.headers, data: { name: `Contato QA ${suffix}` },
    });
    expect(newContact.status()).toBe(201);
    const contactId = (await newContact.json()).data.id;
    const newTicket = await request.post(`${api}/api/tickets`, {
      headers: admin.headers, data: { contactId, queueId: queue.id, channel: 'WHATSAPP', subject: `QA ${suffix}` },
    });
    expect(newTicket.status()).toBe(201);
    const ticketId = (await newTicket.json()).data.id;
    expect((await request.post(`${api}/api/tickets/${ticketId}/notes`, {
      headers: admin.headers, data: { body: `Nota reservada ${suffix}`, visibility: 'private' },
    })).status()).toBe(201);
    expect((await request.delete(`${api}/api/queues/${queue.id}`, { headers: agent.headers })).status()).toBe(403);
    const archived = await request.delete(`${api}/api/queues/${queue.id}`, { headers: admin.headers });
    expect(archived.ok()).toBeTruthy();
    for (const [current, expected] of [[admin, 1], [agent, 0]] as const) {
      const ticket = await request.get(`${api}/api/tickets/${ticketId}?include=notes`, { headers: current.headers });
      expect(ticket.status()).toBe(200);
      expect((await ticket.json()).data.notes ?? []).toHaveLength(expected);
    }
  });

  test('restringe mesclagem a administradores e preserva o bloqueio de contato', async ({ request }) => {
    const admin = await login(request);
    const agent = await login(request, 'agente@ticketz.com', 'demo-tenant', 'agent123');
    const contacts = `${api}/api/contacts`;
    const createContact = async (name: string, isBlocked: boolean, document?: string) => {
      const response = await request.post(contacts, { headers: admin.headers, data: { name, isBlocked, document } });
      expect(response.status()).toBe(201);
      return (await response.json()).data.id as string;
    };
    const targetId = await createContact('QA mesclagem destino', false);
    const blocked = await createContact('QA mesclagem origem', true, 'QA-01');
    const different = await createContact('QA mesclagem divergente', false, 'QA-02');
    const merge = (headers: typeof admin.headers, sourceIds: string[]) =>
      request.post(`${contacts}/merge`, { headers, data: { targetId, sourceIds } });
    expect((await merge(agent.headers, [blocked])).status()).toBe(403);
    expect((await merge(admin.headers, [blocked, different])).status()).toBe(409);
    expect((await request.get(`${contacts}/${blocked}`, { headers: admin.headers })).status()).toBe(200);
    const merged = await merge(admin.headers, [blocked]);
    expect(merged.status()).toBe(200);
    expect((await merged.json()).data).toMatchObject({ id: targetId, isBlocked: true, document: 'QA-01' });
  });

  test('recebe webhook assinado uma vez e materializa a conversa', async ({ request }) => {
    test.skip(!webhookKey || !webhookSecret, 'Requer chaves descartáveis do webhook de teste.');
    const session = await login(request);
    const id = `qa-${randomUUID()}`;
    const timestamp = new Date().toISOString();
    const payload = JSON.stringify({
      id, type: 'MESSAGE_INBOUND', tenantId: 'demo-tenant', instanceId: 'demo-whatsapp', timestamp,
      payload: { instanceId: 'demo-whatsapp', timestamp, direction: 'INBOUND',
        contact: { phone: '+5562999887766', name: 'Maria Helena Souza' },
        message: { id, type: 'text', text: id },
        metadata: { contact: { remoteJid: '5562999887766@s.whatsapp.net' } },
      },
    });
    const endpoint = `${api}/api/webhooks/whatsapp`;
    const headers = { 'Content-Type': 'application/json', 'x-api-key': webhookKey,
      'x-webhook-signature': createHmac('sha256', webhookSecret).update(payload).digest('hex') };
    expect((await request.post(endpoint, { headers: { ...headers, 'x-webhook-signature': '0'.repeat(64) }, data: payload })).status()).toBe(401);
    expect((await request.post(endpoint, { headers: { ...headers, 'x-tenant-id': 'acme-tenant' }, data: payload })).status()).toBe(403);
    expect((await request.post(endpoint, { headers, data: payload })).status()).toBe(204);
    expect((await request.post(endpoint, { headers, data: payload })).status()).toBe(204);
    await expect.poll(async () => {
      const tickets = await request.get(`${api}/api/tickets?include=contact&limit=50`, { headers: session.headers });
      expect(tickets.status()).toBe(200);
      return (await tickets.json()).data.items.filter((ticket: { lastMessagePreview: string }) => ticket.lastMessagePreview === id).length;
    }).toBe(1);
  });

  test('um webhook histórico não reabre a janela de atendimento', async ({ request }) => {
    test.skip(!webhookKey || !webhookSecret, 'Requer chaves descartáveis do webhook de teste.');
    const session = await login(request);
    const id = `qa-historical-${randomUUID()}`;
    const timestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const syntheticSuffix = Number(BigInt(`0x${randomUUID().slice(0, 8)}`) % 100n);
    const phone = `+120255501${String(syntheticSuffix).padStart(2, '0')}`;
    const event = JSON.stringify({
      id, type: 'MESSAGE_INBOUND', tenantId: 'demo-tenant', instanceId: 'demo-whatsapp', timestamp,
      payload: { instanceId: 'demo-whatsapp', timestamp, direction: 'INBOUND',
        contact: { phone, name: 'Contato QA histórico' },
        message: { id, type: 'text', text: id },
        metadata: { contact: { remoteJid: `${phone.slice(1)}@s.whatsapp.net` } },
      },
    });
    const received = await request.post(`${api}/api/webhooks/whatsapp`, {
      headers: { 'Content-Type': 'application/json', 'x-api-key': webhookKey,
        'x-webhook-signature': createHmac('sha256', webhookSecret).update(event).digest('hex') },
      data: event,
    });
    expect(received.status()).toBe(204);
    let ticketId = '';
    await expect.poll(async () => {
      const { data } = await (await request.get(`${api}/api/tickets?include=contact&limit=50`, { headers: session.headers })).json();
      ticketId = data.items.find((ticket: { lastMessagePreview: string }) => ticket.lastMessagePreview === id)?.id ?? '';
      return Boolean(ticketId);
    }).toBeTruthy();
    const blocked = await request.post(`${api}/api/tickets/messages`, {
      headers: session.headers,
      data: { ticketId, instanceId: 'demo-whatsapp', content: 'Resposta de teste', idempotencyKey: randomUUID() },
    });
    expect(blocked.status()).toBe(409);
    expect((await blocked.json()).error.message).toMatch(/janela de atendimento/i);
  });

  test('registra uma intenção por oportunidade e detecta edição concorrente', async ({ request }) => {
    const admin = await login(request);
    const other = await login(request, 'admin@acme.test', 'acme-tenant');
    const contacts = await request.get(`${api}/api/contacts`, { headers: admin.headers });
    const { data } = await contacts.json();
    const contactId = (Array.isArray(data) ? data : data.items)[0].id;
    const endpoint = `${api}/api/crm/opportunities`;
    const requestArgs = {
      headers: { ...admin.headers, 'Idempotency-Key': randomUUID() },
      data: { contactId, agreementRef: 'Convênio QA', employmentRef: 'Vínculo QA', productRef: 'Produto QA', nextAction: 'Revisar dados' },
    };
    const responses = await Promise.all([request.post(endpoint, requestArgs), request.post(endpoint, requestArgs)]);
    expect(responses.map(response => response.status()).sort()).toEqual([200, 201]);
    const [first, second] = await Promise.all(responses.map(response => response.json()));
    expect(first.data.id).toBe(second.data.id);
    const detail = `${endpoint}/${first.data.id}`;
    expect((await request.get(detail, { headers: other.headers })).status()).toBe(404);
    const update = (reason: string) => request.patch(detail, {
      headers: admin.headers, data: { version: 1, stage: 'proposta', nextAction: 'Conferir documentos', reason },
    });
    expect(first.data.stage).toBe('qualificacao');
    const updates = await Promise.all([update('Operador A'), update('Operador B')]);
    expect(updates.map(response => response.status()).sort()).toEqual([200, 409]);
    const stored = await (await request.get(detail, { headers: admin.headers })).json();
    expect(stored.data.version).toBe(2);
    expect(stored.data.stage).toBe('proposta');
    expect(stored.data.activities).toHaveLength(2);
    expect(stored.data.activities.map((activity: { stage: string }) => activity.stage)).toEqual(['proposta', 'qualificacao']);
  });

  test('funil único: a etapa do lead acompanha as conversas abertas do contato', async ({ request }) => {
    const admin = await login(request);
    const other = await login(request, 'admin@acme.test', 'acme-tenant');
    const suffix = randomUUID().slice(0, 8);
    const queue = await request.post(`${api}/api/queues`, { headers: admin.headers, data: { name: `Fila funil ${suffix}` } });
    expect(queue.status()).toBe(201);
    const queueId = (await queue.json()).data.id;
    const contact = await request.post(`${api}/api/contacts`, { headers: admin.headers, data: { name: `Funil QA ${suffix}` } });
    expect(contact.status()).toBe(201);
    const contactId = (await contact.json()).data.id;
    const lead = await request.post(`${api}/api/leads`, { headers: admin.headers, data: { contactId, source: 'WHATSAPP' } });
    expect(lead.status()).toBe(201);
    const leadId = (await lead.json()).data.id;
    const ticket = await request.post(`${api}/api/tickets`, {
      headers: admin.headers, data: { contactId, queueId, channel: 'WHATSAPP', subject: `Funil ${suffix}` },
    });
    expect(ticket.status()).toBe(201);
    const ticketId = (await ticket.json()).data.id;
    expect((await ticket.json()).data.stage).toBe('novo');

    const setStage = (stage: string, headers = admin.headers) =>
      request.patch(`${api}/api/crm/leads/${leadId}/stage`, { headers, data: { stage, reason: `QA ${stage}` } });
    const ticketStage = async () =>
      (await (await request.get(`${api}/api/tickets/${ticketId}`, { headers: admin.headers })).json()).data.stage;
    const leadStage = async () =>
      (await (await request.get(`${api}/api/crm/leads/${leadId}`, { headers: admin.headers })).json()).data.stage;

    const moved = await setStage('proposta');
    expect(moved.status()).toBe(200);
    expect((await moved.json()).data).toMatchObject({ id: leadId, contactId, stage: 'proposta' });
    expect(await ticketStage()).toBe('proposta');

    const fromInbox = await request.put(`${api}/api/tickets/${ticketId}`, { headers: admin.headers, data: { stage: 'documentacao' } });
    expect(fromInbox.status()).toBe(200);
    expect((await fromInbox.json()).data.stage).toBe('documentacao');
    expect(await leadStage()).toBe('documentacao');

    const filters = encodeURIComponent(JSON.stringify({ stages: ['documentacao'], search: `Funil QA ${suffix}` }));
    const filtered = await (await request.get(`${api}/api/crm/leads?filters=${filters}`, { headers: admin.headers })).json();
    expect(filtered.data.items.map((item: { id: string }) => item.id)).toEqual([leadId]);
    const timeline = await (await request.get(`${api}/api/crm/leads/${leadId}/timeline`, { headers: admin.headers })).json();
    expect(timeline.data.filter((event: { type: string }) => event.type === 'status_change')).toHaveLength(2);

    expect((await setStage('etapa-inexistente')).status()).toBe(400);
    expect((await setStage('ganho', other.headers)).status()).toBe(404);
    expect((await setStage('ganho')).status()).toBe(200);
    const reopened = await setStage('proposta');
    expect(reopened.status()).toBe(409);
    expect((await reopened.json()).error.code).toBe('INVALID_STAGE_TRANSITION');
    expect(await ticketStage()).toBe('ganho');
  });

  test('login e cadastro de oportunidade no navegador', async ({ page, request }) => {
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(`${web}/login`);
    await page.locator('#email').fill('admin@ticketz.com');
    await page.locator('#tenant').fill('demo-tenant');
    await page.locator('#password').fill('admin123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Visão geral da operação' })).toBeVisible();
    const cookie = (await page.context().cookies()).find(entry => entry.name === 'corban_refresh');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
    await page.evaluate(() => {
      localStorage.removeItem('leadengine.auth.session.v1');
      sessionStorage.removeItem('leadengine.auth.session.v1');
    });
    const renewal = page.waitForResponse(res => res.url().endsWith('/api/auth/token/refresh'));
    await page.reload();
    const renewed = await renewal;
    expect(renewed.status()).toBe(200);
    expect((await renewed.json()).data.token).not.toHaveProperty('refreshToken');
    await expect(page.getByRole('heading', { name: 'Visão geral da operação' })).toBeVisible();
    await page.goto(`${web}/inbox`);
    await page.getByRole('button', { name: 'Mostrar detalhes do contato' }).click();
    const contactPanel = page.getByRole('dialog', { name: /Detalhes de/ });
    await expect(contactPanel.getByRole('link', { name: 'Abrir contato', exact: true })).toHaveAttribute('href', /^\/contacts\//);
    await contactPanel.getByRole('link', { name: 'Ver oportunidades', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nova oportunidade', exact: true })).toBeVisible();
    await page.goto(`${web}/crm`);
    await expect(page.getByRole('link', { name: 'Oportunidades', exact: true })).toBeVisible();
    await expect(page.getByText(/Lead exemplo/)).toHaveCount(0);
    for (const route of ['/channels', '/campaigns']) {
      await page.goto(`${web}${route}`);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.getByText('WhatsAppInstances services não foram inicializados.')).toHaveCount(0);
    }

    const admin = await login(request);
    const contacts = await request.get(`${api}/api/contacts`, { headers: admin.headers });
    const { data } = await contacts.json();
    const contactId = (Array.isArray(data) ? data : data.items)[0].id;
    const label = `QA ${randomUUID().slice(0, 8)}`;
    await page.goto(`${web}/crm/opportunities?contactId=${encodeURIComponent(contactId)}`);
    await page.getByLabel('Convênio', { exact: true }).fill('Convênio de teste');
    await page.getByLabel('Referência do vínculo').fill('Vínculo de teste');
    await page.getByLabel('Produto', { exact: true }).fill(label);
    await page.getByLabel('Próxima ação', { exact: true }).fill('Revisar dados');
    await page.getByRole('button', { name: 'Criar oportunidade' }).click();
    const item = page.getByRole('listitem').filter({ hasText: label });
    await expect(item).toBeVisible();
    await item.getByRole('button', { name: 'Atualizar oportunidade' }).click();
    await item.getByRole('combobox', { name: 'Etapa' }).selectOption('proposta');
    await item.getByLabel('Motivo da atualização').fill('Dados revisados');
    await item.getByRole('button', { name: 'Salvar atualização' }).click();
    await expect(item.getByText(/Proposta · Dados revisados/)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Abrir navegação' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Oportunidades', exact: true })).toBeVisible();
  });
});
