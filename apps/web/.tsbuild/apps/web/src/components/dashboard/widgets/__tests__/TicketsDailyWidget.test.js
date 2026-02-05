import { jsx as _jsx } from "react/jsx-runtime";
/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
vi.mock('recharts', () => {
    const MockContainer = ({ children, ...props }) => (_jsx("div", { ...props, children: children }));
    const MockElement = ({ children, ...props }) => _jsx("div", { ...props, children: children });
    return {
        ResponsiveContainer: MockContainer,
        BarChart: MockElement,
        Bar: MockElement,
        CartesianGrid: MockElement,
        XAxis: MockElement,
        YAxis: MockElement,
        Tooltip: MockElement,
    };
});
import { TicketsDailyWidget } from '../TicketsDailyWidget';
afterEach(() => {
    cleanup();
});
describe('TicketsDailyWidget', () => {
    it('renders skeleton while loading', () => {
        render(_jsx(TicketsDailyWidget, { data: [], loading: true }));
        expect(screen.getByTestId('tickets-daily-skeleton')).toBeInTheDocument();
    });
    it('shows empty state when there is no data', () => {
        render(_jsx(TicketsDailyWidget, { data: [], loading: false }));
        expect(screen.getByTestId('tickets-daily-empty')).toBeInTheDocument();
    });
    it('renders chart when data is available', () => {
        const data = [
            { name: 'Seg', abertos: 5, pendentes: 2, fechados: 3 },
            { name: 'Ter', abertos: 3, pendentes: 1, fechados: 4 },
        ];
        render(_jsx(TicketsDailyWidget, { data: data, loading: false }));
        expect(screen.getByTestId('tickets-daily-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('tickets-daily-empty')).not.toBeInTheDocument();
    });
});
