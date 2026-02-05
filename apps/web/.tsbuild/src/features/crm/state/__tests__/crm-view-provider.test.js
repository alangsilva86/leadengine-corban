import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CrmViewProvider, useCrmViewState } from '../view-context';
import { normalizeCrmFilters } from '../../utils/filter-serialization';
const FiltersConsumer = () => {
    const { filters } = useCrmViewState();
    return _jsx("pre", { "data-testid": "filters", children: JSON.stringify(filters) });
};
const renderWithProvider = (filters, children = _jsx(FiltersConsumer, {})) => render(_jsx(CrmViewProvider, { filters: filters, children: children }));
describe('CrmViewProvider', () => {
    it('updates filters when provider prop changes', async () => {
        const baseFilters = {
            stages: ['prospect'],
            owners: [],
            origins: [],
            channels: [],
            score: { min: 10, max: 50 },
            dateRange: null,
            inactivityDays: null,
            search: ' initial ',
        };
        const initialFilters = normalizeCrmFilters(baseFilters);
        const nextFilters = normalizeCrmFilters({ ...baseFilters, search: 'updated', score: null });
        const { rerender } = renderWithProvider(initialFilters);
        await waitFor(() => {
            expect(screen.getByTestId('filters').textContent).toBe(JSON.stringify(initialFilters));
        });
        rerender(_jsx(CrmViewProvider, { filters: nextFilters, children: _jsx(FiltersConsumer, {}) }));
        await waitFor(() => {
            expect(screen.getByTestId('filters').textContent).toBe(JSON.stringify(nextFilters));
        });
    });
});
