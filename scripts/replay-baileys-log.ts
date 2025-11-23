import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import process from 'node:process';
import {
  getBrokerWebhookUrl,
  getDefaultTenantId,
  getWebhookApiKey,
  refreshWhatsAppEnv,
} from '../apps/api/src/config/whatsapp';
import { buildWebhookAuthHeaders } from './whatsapp-webhook-auth';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(
    'Usage: pnpm exec tsx scripts/replay-baileys-log.ts <log-file> [--url=http://localhost:3000/api/integrations/whatsapp/webhook]'
  );
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), args[0]);
const extraArgs = args.slice(1);

refreshWhatsAppEnv();

const options: { url: string; apiKey: string | null; tenantId: string | null; bearerToken: string | null } = {
  url:
    process.env.WHATSAPP_WEBHOOK_REPLAY_URL ||
    getBrokerWebhookUrl() ||
    'http://localhost:3000/api/integrations/whatsapp/webhook',
  apiKey: getWebhookApiKey(),
  tenantId: process.env.TENANT_ID ?? getDefaultTenantId(),
  bearerToken: process.env.AUTH_TOKEN ?? process.env.WHATSAPP_WEBHOOK_AUTH_TOKEN ?? null,
};

for (const arg of extraArgs) {
  if (arg.startsWith('--url=')) {
    options.url = arg.slice('--url='.length);
  } else if (arg.startsWith('--api-key=')) {
    options.apiKey = arg.slice('--api-key='.length);
  } else if (arg.startsWith('--tenant-id=')) {
    options.tenantId = arg.slice('--tenant-id='.length);
  } else if (arg.startsWith('--token=')) {
    options.bearerToken = arg.slice('--token='.length);
  }
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

let total = 0;
let replayed = 0;
let skipped = 0;

const resolvePayload = (record) => {
  if (!record || typeof record !== 'object') {
    return null;
  }

  if (record.payload && typeof record.payload === 'object') {
    return record.payload;
  }

  if (record.event && typeof record.event === 'object') {
    return record.event;
  }

  if (record.data && typeof record.data === 'object') {
    return record.data;
  }

  return record;
};

const postEvent = async (payload) => {
  const body = typeof payload === 'object' && !Array.isArray(payload) ? payload : { events: payload };
  const rawBody = JSON.stringify(body);
  const headers = {
    'content-type': 'application/json',
    ...buildWebhookAuthHeaders(rawBody, {
      apiKey: options.apiKey,
      tenantId: options.tenantId,
      bearerToken: options.bearerToken,
    }),
  } as Record<string, string>;

  const response = await fetch(options.url, {
    method: 'POST',
    headers,
    body: rawBody,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed with status ${response.status}: ${text}`);
  }
};

const main = async () => {
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    total += 1;

    try {
      const parsed = JSON.parse(trimmed);
      const payload = resolvePayload(parsed);
      if (!payload) {
        skipped += 1;
        continue;
      }

      await postEvent(payload);
      replayed += 1;
      console.log(`Replayed event #${replayed}`);
    } catch (error) {
      skipped += 1;
      console.warn(`Skipping line ${total}:`, error.message);
    }
  }

  console.log('Replay finished', { total, replayed, skipped, url: options.url });
};

main().catch((error) => {
  console.error('Replay failed:', error);
  process.exit(1);
});
