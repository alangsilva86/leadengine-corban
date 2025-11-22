import { describe, expect, it } from 'vitest';

import { getTicketIdentity } from '../../utils/ticketIdentity.js';

describe('getTicketIdentity', () => {
  it('prefers push name metadata over placeholder contact names', () => {
    const ticket = {
      metadata: {
        contact: {
          name: 'Contato WhatsApp',
          pushName: 'João Cliente',
          remoteJid: '5511999999999@s.whatsapp.net',
        },
        whatsapp: {
          pushName: 'João Cliente',
          remoteJid: '5511999999999@s.whatsapp.net',
        },
      },
      contact: {
        name: 'Contato WhatsApp',
        fullName: 'Contato WhatsApp',
      },
    };

    const identity = getTicketIdentity(ticket);

    expect(identity.displayName).toBe('João Cliente');
    expect(identity.displayPhone).toBe('+55 (11) 99999-9999');
    expect(identity.remoteJid).toBe('5511999999999');
  });

  it('falls back to sanitized phone when only placeholder names are available', () => {
    const ticket = {
      metadata: {
        contact: {
          name: 'Contato WhatsApp',
          remoteJid: '5511987654321@s.whatsapp.net',
        },
      },
      contact: {
        name: 'Contato WhatsApp',
      },
    };

    const identity = getTicketIdentity(ticket);

    expect(identity.displayName).toBe('+5511987654321');
    expect(identity.displayPhone).toBe('+55 (11) 98765-4321');
    expect(identity.remoteJid).toBe('5511987654321');
  });

  it('avoids returning WhatsApp JID when better candidates are missing', () => {
    const ticket = {
      metadata: {
        contact: {
          remoteJid: '5511555555555@s.whatsapp.net',
        },
      },
    };

    const identity = getTicketIdentity(ticket);

    expect(identity.displayName).toBe('+5511555555555');
    expect(identity.remoteJid).toBe('5511555555555');
  });
});

