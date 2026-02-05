import { jsx as _jsx } from "react/jsx-runtime";
/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EventCard from '../EventCard.jsx';
const buildEntry = (overrides = {}) => ({
    id: 'event-1',
    type: 'event',
    date: '2024-02-01T12:00:00.000Z',
    payload: {
        label: 'Evento genérico',
        description: 'Descrição do evento',
    },
    ...overrides,
});
describe('EventCard', () => {
    it('renders advanced details when payload includes snapshot/metadata', () => {
        const entry = buildEntry({
            type: 'deal',
            payload: {
                label: 'Negócio registrado',
                calculationSnapshot: {
                    type: 'deal',
                    bank: { label: 'Banco Teste' },
                    term: 24,
                    installment: 250,
                    netAmount: 1000,
                },
                metadata: { origin: 'chat' },
            },
        });
        render(_jsx(EventCard, { entry: entry }));
        expect(screen.getByText('Negócio registrado')).toBeInTheDocument();
        expect(screen.getByText(/Ver detalhes avançados/)).toBeInTheDocument();
        expect(screen.getByText('Snapshot')).toBeInTheDocument();
        expect(screen.getByText('Metadata')).toBeInTheDocument();
    });
    it('falls back to a generic rendering for unknown types', () => {
        const entry = buildEntry({
            type: 'custom',
            payload: {
                label: 'Atualização especial',
                description: 'Conteúdo do evento',
            },
        });
        render(_jsx(EventCard, { entry: entry }));
        expect(screen.getByText('Atualização especial')).toBeInTheDocument();
        expect(screen.queryByText('Ver detalhes avançados')).not.toBeInTheDocument();
    });
});
