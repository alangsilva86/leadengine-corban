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
        PieChart: MockElement,
        Pie: MockElement,
        Cell: ({ children, ...props }) => _jsx("div", { ...props, children: children }),
        Tooltip: MockElement,
    };
});
import { ChannelDistributionWidget } from '../ChannelDistributionWidget';
afterEach(() => {
    cleanup();
});
describe('ChannelDistributionWidget', () => {
    it('renders skeleton while loading', () => {
        render(_jsx(ChannelDistributionWidget, { data: [], loading: true }));
        expect(screen.getByTestId('channel-distribution-skeleton')).toBeInTheDocument();
    });
    it('shows empty state when there is no data', () => {
        render(_jsx(ChannelDistributionWidget, { data: [], loading: false }));
        expect(screen.getByTestId('channel-distribution-empty')).toBeInTheDocument();
    });
    it('renders chart and rows when data is available', () => {
        const data = [
            { name: 'WhatsApp', value: 60, color: '#25D366' },
            { name: 'Email', value: 40, color: '#1E88E5' },
        ];
        render(_jsx(ChannelDistributionWidget, { data: data, loading: false }));
        expect(screen.getByTestId('channel-distribution-chart')).toBeInTheDocument();
        expect(screen.getAllByTestId('channel-distribution-row')).toHaveLength(data.length);
    });
});
