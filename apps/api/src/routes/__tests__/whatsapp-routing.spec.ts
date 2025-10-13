import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('WhatsApp routing modules', () => {
  const whatsappMessagesPath = resolve(__dirname, '../integrations/whatsapp.messages.ts');

  it('do not reference the legacy Baileys client', () => {
    const contents = readFileSync(whatsappMessagesPath, 'utf8');
    expect(contents).not.toMatch(/BaileysClient/);
    expect(contents).not.toMatch(/baileys-client/);
  });

  it('do not access process.env directly', () => {
    const contents = readFileSync(whatsappMessagesPath, 'utf8');
    expect(contents).not.toMatch(/process\.env/);
  });
});
