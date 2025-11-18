import { useCallback, useEffect, useReducer } from 'react';
import {
  SELECTION_ACTIONS,
  selectionReducer,
  createSelectionFallback,
} from '../utils/simulationReducers.js';

const normalizeSelection = (selection) => (Array.isArray(selection) ? selection : []);

const useProposalSelection = ({ open, visibleOffers, initialSelection }) => {
  const [selection, dispatchSelection] = useReducer(selectionReducer, normalizeSelection(initialSelection));

  useEffect(() => {
    if (!open) {
      return;
    }
    dispatchSelection({
      type: SELECTION_ACTIONS.RESET,
      payload: normalizeSelection(initialSelection),
    });
  }, [initialSelection, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const validKeys = new Set(
      visibleOffers.flatMap((offer) => offer.terms.map((term) => `${offer.id}::${term.id}`)),
    );
    dispatchSelection({
      type: SELECTION_ACTIONS.SYNC_WITH_OFFERS,
      payload: {
        validKeys,
        fallbackSelection: createSelectionFallback(visibleOffers),
      },
    });
  }, [open, visibleOffers]);

  const handleToggleOfferSelection = useCallback((offerId, termId, checked) => {
    dispatchSelection({
      type: SELECTION_ACTIONS.TOGGLE,
      payload: { offerId, termId, checked },
    });
  }, []);

  return { selection, handleToggleOfferSelection };
};

export default useProposalSelection;
