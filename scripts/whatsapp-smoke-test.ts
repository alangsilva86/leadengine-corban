/**
 * WhatsApp inbound smoke test.
 *
 * Expects the following environment variables:
 *  - API_URL
 *  - TENANT_ID
 *  - INSTANCE_ID
 * Optional:
 *  - WHATSAPP_WEBHOOK_API_KEY (obrigatório no modo http)
 *  - TEST_PHONE (defaults to +5511999999999)
 *  - TEST_NAME (defaults to "QA Bot")
 *  - MESSAGE_TEXT (custom text for the inbound payload)
 *  - EXPECT_WHATSAPP_MODE / WHATSAPP_MODE (assert runtime transport)
 *
 * Usage:
 *   API_URL="https://ticketzapi-production.up.railway.app" \
 *   WHATSAPP_WEBHOOK_API_KEY="..." \
 *   TENANT_ID="demo-tenant" \
 *   INSTANCE_ID="alan" \
 *   pnpm exec tsx scripts/whatsapp-smoke-test.ts
 */

import { randomUUID } from 'node:crypto';
import process from 'node:process';
import {
  getWebhookApiKey,
  getWhatsAppMode,
  refreshWhatsAppEnv,
} from '../apps/api/src/config/whatsapp';

refreshWhatsAppEnv();

const requiredEnv = ['API_URL', 'TENANT_ID', 'INSTANCE_ID'];

const missing = requiredEnv.filter((key) => !process.env[key] || process.env[key].trim().length === 0);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const API_URL = process.env.API_URL.replace(/\/+$/, '');
const WEBHOOK_KEY = getWebhookApiKey();
const TENANT_ID = process.env.TENANT_ID;
const INSTANCE_ID = process.env.INSTANCE_ID;
const TEST_PHONE = process.env.TEST_PHONE ?? '+5511999999999';
const TEST_NAME = process.env.TEST_NAME ?? 'QA Bot';
const MESSAGE_TEXT =
  process.env.MESSAGE_TEXT ??
  `Fluxo Essencial • ${new Date().toISOString()} • ${Math.random().toString(36).slice(2, 8)}`;

const SOCKET_PATH = process.env.SOCKET_IO_PATH ?? '/socket.io';

const CONFIGURED_WHATSAPP_MODE = getWhatsAppMode();
const expectedModeOverride = (process.env.EXPECT_WHATSAPP_MODE ?? '').trim().toLowerCase();
const EXPECTED_WHATSAPP_MODE = expectedModeOverride || CONFIGURED_WHATSAPP_MODE;
const SHOULD_ASSERT_RUNTIME = expectedModeOverride.length > 0;

const timeout = (ms, label) =>
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(label ?? `Timeout after ${ms}ms`)), ms);
  });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWhatsAppRuntime = async () => {
  try {
    const response = await fetch(`${API_URL}/healthz`, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const runtimeSource = (() => {
      const whatsapp = payload.whatsapp;
      if (whatsapp && typeof whatsapp === 'object') {
        if (whatsapp.runtime && typeof whatsapp.runtime === 'object') {
          return whatsapp.runtime;
        }

        return whatsapp;
      }

      if (payload.whatsappRuntime && typeof payload.whatsappRuntime === 'object') {
        return payload.whatsappRuntime;
      }

      return null;
    })();

    if (!runtimeSource) {
      return null;
    }

    const mode =
      typeof runtimeSource.mode === 'string' && runtimeSource.mode.trim().length > 0
        ? runtimeSource.mode.trim()
        : null;
    const status =
      typeof runtimeSource.status === 'string' && runtimeSource.status.trim().length > 0
        ? runtimeSource.status.trim()
        : null;
    const transport =
      typeof runtimeSource.transport === 'string' && runtimeSource.transport.trim().length > 0
        ? runtimeSource.transport.trim()
        : null;
    const disabled = Boolean(runtimeSource.disabled);

    return { mode, status, transport, disabled };
  } catch {
    return null;
  }
};

const resolveSocketIoClient = async () => {
  try {
    return await import('socket.io-client');
  } catch (error) {
    const { pathToFileURL } = await import('node:url');
    const { resolve } = await import('node:path');
    const candidatePaths = [
      'node_modules/socket.io-client/build/esm/index.js',
      'apps/web/node_modules/socket.io-client/build/esm/index.js',
      'apps/web/node_modules/socket.io-client/dist/index.js',
    ];

    for (const candidate of candidatePaths) {
      try {
        const absolute = resolve(candidate);
        return await import(pathToFileURL(absolute).href);
      } catch {
        // ignore and try next candidate
      }
    }

    throw error;
  }
};

const sanitizePhone = (phone) => phone.replace(/\D+/g, '');

const sendInboundWebhook = async ({ messageId, requestId }) => {
  const payload = {
    events: [
      {
        id: messageId,
        instanceId: INSTANCE_ID,
        timestamp: new Date().toISOString(),
        type: 'MESSAGE_INBOUND',
        from: {
          phone: TEST_PHONE,
          name: TEST_NAME,
          pushName: TEST_NAME,
        },
        message: {
          id: messageId,
          conversation: MESSAGE_TEXT,
          type: 'text',
        },
        metadata: {
          broker: 'baileys',
          source: 'smoke-test',
        },
      },
    ],
  };

  const response = await fetch(`${API_URL}/api/integrations/whatsapp/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
      ...(WEBHOOK_KEY ? { 'x-api-key': WEBHOOK_KEY } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (response.status !== 202) {
    const text = await response.text();
    throw new Error(`Webhook returned ${response.status}: ${text}`);
  }
};

const fetchTicketByPhone = async () => {
  const query = new URLSearchParams({
    search: sanitizePhone(TEST_PHONE),
    limit: '10',
    sortOrder: 'desc',
    channel: 'WHATSAPP',
  });

  const response = await fetch(`${API_URL}/api/tickets?${query.toString()}`, {
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': TENANT_ID,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET /api/tickets failed with ${response.status}: ${text}`);
  }

  const json = await response.json();
  const items = json?.data?.items ?? [];
  const normalizedPhone = sanitizePhone(TEST_PHONE);

  return items.find((ticket) => {
    const contactPhone = sanitizePhone(ticket?.contact?.phone ?? '');
    return contactPhone === normalizedPhone;
  });
};

const fetchMessageById = async ({ ticketId, messageId }) => {
  const query = new URLSearchParams({
    limit: '10',
    sortOrder: 'desc',
  });

  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/messages?${query.toString()}`, {
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': TENANT_ID,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET /api/tickets/${ticketId}/messages failed with ${response.status}: ${text}`);
  }

  const json = await response.json();
  const items = json?.data?.items ?? [];
  return items.find(
    (entry) =>
      entry?.id === messageId ||
      entry?.metadata?.broker?.messageId === messageId ||
      entry?.metadata?.raw?.message?.key?.id === messageId
  );
};

const connectSocket = async () => {
  const { io } = await resolveSocketIoClient();

  const socket = io(API_URL, {
    path: SOCKET_PATH,
    transports: ['websocket', 'polling'],
    reconnection: false,
    timeout: 8_000,
  });

  await Promise.race([
    new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', (error) => reject(error instanceof Error ? error : new Error(String(error))));
    }),
    timeout(8_000, 'Socket connection timeout'),
  ]);

  socket.emit('join-tenant', TENANT_ID);
  return socket;
};

const main = async () => {
  console.info('🚀 WhatsApp inbound smoke test started');
  console.info(`⚙️ Configured WhatsApp transport: ${CONFIGURED_WHATSAPP_MODE}`);

  const runtime = await fetchWhatsAppRuntime();
  if (runtime) {
    const parts = [runtime.mode ?? 'unknown'];
    if (runtime.transport && runtime.transport !== runtime.mode) {
      parts.push(`transport=${runtime.transport}`);
    }
    if (runtime.status) {
      parts.push(`status=${runtime.status}${runtime.disabled ? ' (disabled flag)' : ''}`);
    }
    console.info(`🛰️ WhatsApp transport runtime: ${parts.join(' | ')}`);

    if (SHOULD_ASSERT_RUNTIME) {
      const normalized = (runtime.mode ?? '').toLowerCase();
      if (normalized !== EXPECTED_WHATSAPP_MODE) {
        throw new Error(
          `Expected WhatsApp mode "${EXPECTED_WHATSAPP_MODE}" but runtime reported "${runtime.mode ?? 'unknown'}"`
        );
      }
    }
  } else {
    console.warn('⚠️ Unable to resolve WhatsApp runtime mode from /healthz; continuing smoke test.');
  }

  if (!WEBHOOK_KEY) {
    console.warn('⚠️ WhatsApp webhook API key not configured; assuming passthrough mode is allowed.');
  }

  const requestId = randomUUID();
  const inboundMessageId = `wamid-${randomUUID()}`;

  const socket = await connectSocket();
  console.info('🔌 Socket connected and joined tenant room');

  const messageEventPromise = new Promise((resolve, reject) => {
    const guard = setTimeout(() => {
      socket.off('messages.new', handler);
      reject(new Error('Timed out waiting for messages.new event'));
    }, 15_000);

    const handler = (payload) => {
      const brokerMessageId = payload?.message?.metadata?.broker?.messageId;
      const conversation = payload?.message?.content ?? payload?.message?.metadata?.raw?.message?.conversation;

      if (brokerMessageId === inboundMessageId || conversation === MESSAGE_TEXT) {
        clearTimeout(guard);
        socket.off('messages.new', handler);
        resolve(payload);
      }
    };

    socket.on('messages.new', handler);
  });

  await sendInboundWebhook({ messageId: inboundMessageId, requestId });
  console.info('📬 Webhook accepted (202) and enqueued');

  let realtimeEnvelope;
  try {
    realtimeEnvelope = await messageEventPromise;
    console.info('📡 Realtime event received via socket');
  } catch (error) {
    console.error('⚠️ Realtime event not received in time. Continuing with REST validation.');
  }

  const ticketIdFromRealtime = realtimeEnvelope?.ticketId ?? realtimeEnvelope?.message?.ticketId ?? null;

  let ticket = null;
  const maxTicketPolls = 10;

  if (ticketIdFromRealtime) {
    for (let attempt = 1; attempt <= maxTicketPolls; attempt += 1) {
      try {
        const response = await fetch(`${API_URL}/api/tickets/${ticketIdFromRealtime}`, {
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': TENANT_ID,
          },
        });

        if (response.ok) {
          const payload = await response.json().catch(() => ({}));
          if (payload?.data) {
            ticket = payload.data;
            break;
          }
        }
      } catch {
        // ignore retry
      }

      await wait(750);
    }
  }

  if (!ticket) {
    for (let attempt = 1; attempt <= maxTicketPolls; attempt += 1) {
      ticket = await fetchTicketByPhone();
      if (ticket) {
        break;
      }
      await wait(750);
    }
  }

  if (!ticket) {
    throw new Error('Ticket not found for the test contact phone');
  }

  console.info(`🎟️ Ticket resolved: ${ticket.id}`);

  if (ticketIdFromRealtime && ticketIdFromRealtime !== ticket.id) {
    console.warn(`⚠️ Ticket mismatch (socket=${ticketIdFromRealtime}, rest=${ticket.id})`);
  }

  const messageLookupId = realtimeEnvelope?.message?.id ?? inboundMessageId;
  let message = null;
  const maxMessagePolls = 10;
  for (let attempt = 1; attempt <= maxMessagePolls; attempt += 1) {
    message = await fetchMessageById({ ticketId: ticket.id, messageId: messageLookupId });
    if (message) {
      break;
    }
    await wait(750);
  }

  if (!message) {
    throw new Error('Persisted message not found for ticket');
  }

  if (message.direction !== 'INBOUND') {
    throw new Error(`Unexpected message direction: ${message.direction}`);
  }

  console.info('✅ Message persisted and visible via REST API');

  if (socket.connected) {
    socket.disconnect();
  }

  console.info('🏁 WhatsApp inbound smoke test completed successfully');
};

main().catch((error) => {
  console.error(`❌ Smoke test failed: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
