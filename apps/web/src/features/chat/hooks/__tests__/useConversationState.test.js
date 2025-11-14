/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useConversationState from '../useConversationState.js';

const buildMessage = (id, createdAt, extra = {}) => ({
  id,
  createdAt,
  direction: 'INBOUND',
  content: 'olá',
  ...extra,
});

describe('useConversationState', () => {
  it('merges messages, notes and sales events in chronological order', () => {
    const ticket = {
      id: 'ticket-1',
      timeline: {
        firstInboundAt: '2024-02-01T08:00:00.000Z',
        lastInboundAt: '2024-02-02T09:00:00.000Z',
      },
      salesTimeline: [
        {
          id: 'sales-sim-1',
          type: 'simulation.created',
          createdAt: '2024-02-01T10:00:00.000Z',
          payload: {
            stage: 'qualificando',
            calculationSnapshot: { amount: 1000 },
          },
        },
        {
          id: 'sales-deal-1',
          type: 'deal.created',
          createdAt: '2024-02-02T11:00:00.000Z',
          payload: {
            stage: 'ganho',
            calculationSnapshot: { netValue: 2500 },
            metadata: { origin: 'crm' },
          },
        },
      ],
    };

    const messagesPages = [
      {
        items: [
          buildMessage('msg-1', '2024-02-01T09:30:00.000Z'),
          buildMessage('msg-2', '2024-02-02T10:30:00.000Z'),
        ],
      },
    ];

    const notes = [
      { id: 'note-1', createdAt: '2024-02-01T08:30:00.000Z', body: 'Agendar retorno' },
    ];

    const { result } = renderHook(() =>
      useConversationState({ ticket, messagesPages, notes })
    );

    const timeline = result.current.timeline;
    const datedEntries = timeline.filter((entry) => entry.type !== 'divider');
    const timestamps = datedEntries.map((entry) => entry.date?.getTime() ?? 0);
    const sorted = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(sorted);

    const simulationEntry = timeline.find((entry) => entry.type === 'simulation');
    expect(simulationEntry?.payload.label).toBe('Simulação registrada');
    expect(simulationEntry?.payload.stageLabel).toBe('Qualificação');
    expect(simulationEntry?.payload.stageValue).toBe('qualificando');
    expect(simulationEntry?.payload.legacyStageValue).toBe('qualificacao');
    expect(simulationEntry?.payload.calculationSnapshot).toEqual({ amount: 1000 });

    const dealEntry = timeline.find((entry) => entry.type === 'deal');
    expect(dealEntry?.payload.metadata).toEqual({ origin: 'crm' });
  });

  it('falls back to a generic label for unknown sales types', () => {
    const ticket = {
      id: 'ticket-2',
      salesTimeline: [
        {
          id: 'custom-1',
          type: 'custom.update',
          createdAt: '2024-02-03T12:00:00.000Z',
          payload: {
            stage: 'novo',
          },
        },
      ],
    };

    const { result } = renderHook(() =>
      useConversationState({ ticket, messagesPages: [], notes: [] })
    );

    const customEntry = result.current.timeline.find((entry) => entry.type === 'custom');
    expect(customEntry?.payload.label).toBe('Atualização de vendas');
    expect(customEntry?.payload.stageLabel).toBe('Novo');
    expect(customEntry?.payload.stageValue).toBe('novo');
  });
});
