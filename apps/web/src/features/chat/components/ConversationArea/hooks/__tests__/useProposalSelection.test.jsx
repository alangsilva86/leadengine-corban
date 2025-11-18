import { act, renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import useProposalSelection from '../useProposalSelection.js';

const baseOffers = [
  {
    id: 'offer-1',
    terms: [
      { id: 'term-1' },
      { id: 'term-2' },
    ],
  },
];

describe('useProposalSelection', () => {
  it('resets when initial selection changes while open', () => {
    const initialSelection = [{ offerId: 'offer-1', termId: 'term-1' }];
    const { result, rerender } = renderHook((props) => useProposalSelection(props), {
      initialProps: { open: true, visibleOffers: baseOffers, initialSelection },
    });

    expect(result.current.selection).toEqual(initialSelection);

    const nextSelection = [{ offerId: 'offer-1', termId: 'term-2' }];
    rerender({ open: true, visibleOffers: baseOffers, initialSelection: nextSelection });

    expect(result.current.selection).toEqual(nextSelection);
  });

  it('toggles offer selections', () => {
    const { result } = renderHook((props) => useProposalSelection(props), {
      initialProps: { open: true, visibleOffers: baseOffers, initialSelection: [] },
    });

    act(() => {
      result.current.handleToggleOfferSelection('offer-1', 'term-1', true);
    });
    expect(result.current.selection).toEqual([{ offerId: 'offer-1', termId: 'term-1' }]);

    act(() => {
      result.current.handleToggleOfferSelection('offer-1', 'term-1', false);
    });
    expect(result.current.selection).toEqual([]);
  });

  it('syncs with visible offers when entries become invalid', () => {
    const initialSelection = [{ offerId: 'offer-1', termId: 'term-2' }];
    const { result, rerender } = renderHook((props) => useProposalSelection(props), {
      initialProps: { open: true, visibleOffers: baseOffers, initialSelection },
    });

    expect(result.current.selection).toEqual(initialSelection);

    rerender({
      open: true,
      visibleOffers: [
        {
          id: 'offer-1',
          terms: [{ id: 'term-1' }],
        },
      ],
      initialSelection,
    });

    expect(result.current.selection).toEqual([{ offerId: 'offer-1', termId: 'term-1' }]);
  });
});
