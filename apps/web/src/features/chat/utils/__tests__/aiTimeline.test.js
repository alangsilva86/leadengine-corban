import { describe, expect, it } from 'vitest';
import {
  buildAiContextTimeline,
  buildAiMessagesPayload,
  sanitizeAiTimeline,
  parseMessageRole,
  getTimelineEntryContent,
} from '../aiTimeline.js';

const createEntry = (id, overrides = {}) => ({
  id: `entry-${id}`,
  type: 'message',
  timestamp: `2024-01-${String(id).padStart(2, '0')}T12:00:00.000Z`,
  payload: {
    id: `payload-${id}`,
    content: `Mensagem ${id}`,
    direction: id % 2 === 0 ? 'outbound' : 'inbound',
    role: id % 2 === 0 ? 'outbound' : 'user',
    author: id % 2 === 0 ? 'Agente' : 'Cliente',
    channel: 'whatsapp',
    timestamp: `2024-01-${String(id).padStart(2, '0')}T12:00:00.000Z`,
    attachments: id === 1 ? [{ id: 'file-1' }] : undefined,
    metadata: {
      direction: 'inbound',
      channel: 'whatsapp',
      contactName: 'Cliente',
    },
    ...overrides.payload,
  },
  ...overrides,
});

describe('aiTimeline utils', () => {
  it('buildAiContextTimeline limita e projeta conteúdo e papel sem alterar dados originais', () => {
    const timeline = [
      createEntry(1),
      createEntry(2, {
        payload: { content: undefined, text: 'Fallback de texto', role: null, direction: 'agent' },
      }),
      createEntry(3, {
        payload: {
          content: undefined,
          body: 'Conteúdo alternativo',
          authorRole: 'system',
          direction: undefined,
        },
      }),
    ];

    const result = buildAiContextTimeline(timeline);

    expect(result).toEqual([
      { content: 'Mensagem 1', role: 'outbound' },
      { content: 'Fallback de texto', role: 'agent' },
      { content: 'Conteúdo alternativo', role: 'system' },
    ]);
  });

  it('buildAiMessagesPayload normaliza papéis, remove mensagens inválidas e respeita o limite máximo', () => {
    const items = [
      ...Array.from({ length: 52 }, (_, index) => createEntry(index + 1)),
      {
        payload: { content: null, direction: 'outbound' },
      },
      {
        payload: { content: 42, direction: 'outbound' },
      },
      {
        payload: { content: 'Mensagem válida', role: 'system' },
      },
    ];

    const result = buildAiMessagesPayload(items);

    expect(result.length).toBe(51);
    expect(result[0]).toEqual({ role: 'assistant', content: 'Mensagem 3' });
    expect(result[result.length - 1]).toEqual({ role: 'system', content: 'Mensagem válida' });
  });

  it('sanitizeAiTimeline mantém compatibilidade com o payload antigo', () => {
    const timeline = [
      createEntry(1),
      createEntry(2, {
        payload: {
          content: undefined,
          text: 'Conteúdo via text',
          attachments: 'invalid',
        },
      }),
      { id: 'raw', value: 'mantém valor bruto' },
    ];

    const result = sanitizeAiTimeline(timeline);

    expect(result).toEqual([
      {
        id: 'entry-1',
        type: 'message',
        timestamp: '2024-01-01T12:00:00.000Z',
        payload: {
          id: 'payload-1',
          direction: 'outbound',
          author: 'Agente',
          role: 'outbound',
          content: 'Mensagem 1',
          channel: 'whatsapp',
          attachments: [{ id: 'file-1' }],
        },
      },
      {
        id: 'entry-2',
        type: 'message',
        timestamp: '2024-01-02T12:00:00.000Z',
        payload: {
          id: 'payload-2',
          direction: 'agent',
          author: 'Agente',
          role: null,
          content: 'Conteúdo via text',
          channel: 'whatsapp',
        },
      },
      { id: 'raw', value: 'mantém valor bruto' },
    ]);
  });

  it('parseMessageRole trata valores desconhecidos como usuário e preserva system/assistant', () => {
    expect(parseMessageRole('assistant')).toBe('assistant');
    expect(parseMessageRole('OUTBOUND')).toBe('assistant');
    expect(parseMessageRole('system')).toBe('system');
    expect(parseMessageRole('customer')).toBe('user');
    expect(parseMessageRole()).toBe('user');
  });

  it('getTimelineEntryContent prioriza content, text, body, message e messageText', () => {
    expect(getTimelineEntryContent({ content: 'conteúdo direto' })).toBe('conteúdo direto');
    expect(getTimelineEntryContent({ text: 'via text' })).toBe('via text');
    expect(getTimelineEntryContent({ body: 'via body' })).toBe('via body');
    expect(getTimelineEntryContent({ message: 'via message' })).toBe('via message');
    expect(getTimelineEntryContent({ messageText: 'via messageText' })).toBe('via messageText');
    expect(getTimelineEntryContent({})).toBeNull();
    expect(getTimelineEntryContent(null)).toBeNull();
  });
});
