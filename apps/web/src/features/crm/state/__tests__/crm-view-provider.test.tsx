import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { CrmViewProvider, useCrmViewState } from '../view-context.tsx';
import { normalizeCrmFilters } from '../../utils/filter-serialization.ts';
import type { CrmFilterState } from '../types.ts';

const FiltersConsumer = () => {
  const { filters } = useCrmViewState();
  return <pre data-testid="filters">{JSON.stringify(filters)}</pre>;
};

const renderWithProvider = (filters: CrmFilterState, children: ReactNode = <FiltersConsumer />) =>
  render(<CrmViewProvider filters={filters}>{children}</CrmViewProvider>);

describe('CrmViewProvider', () => {
  it('updates filters when provider prop changes', async () => {
    const baseFilters: CrmFilterState = {
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

    rerender(
      <CrmViewProvider filters={nextFilters}>
        <FiltersConsumer />
      </CrmViewProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('filters').textContent).toBe(JSON.stringify(nextFilters));
    });
  });
});
