import {
  SELECTION_ACTIONS,
  QUEUE_ALERTS_ACTIONS,
  createSelectionFallback,
  queueAlertsReducer,
  selectionReducer,
} from '../utils/simulationReducers.js';

describe('selectionReducer', () => {
  it('normalizes entries when resetting', () => {
    const initialState = [];
    const next = selectionReducer(initialState, {
      type: SELECTION_ACTIONS.RESET,
      payload: [
        { offerId: ' bank ', termId: ' 72 ' },
        { offerId: ' ', termId: 'invalid' },
      ],
    });
    expect(next).toEqual([{ offerId: 'bank', termId: '72' }]);
  });

  it('adds and removes selections via toggle', () => {
    const added = selectionReducer([], {
      type: SELECTION_ACTIONS.TOGGLE,
      payload: { offerId: 'offer-1', termId: 'term-1', checked: true },
    });
    expect(added).toEqual([{ offerId: 'offer-1', termId: 'term-1' }]);

    const removed = selectionReducer(added, {
      type: SELECTION_ACTIONS.TOGGLE,
      payload: { offerId: 'offer-1', termId: 'term-1', checked: false },
    });
    expect(removed).toEqual([]);
  });

  it('syncs with valid offers and falls back when necessary', () => {
    const state = [
      { offerId: 'offer-a', termId: 'term-a' },
      { offerId: 'offer-b', termId: 'term-b' },
    ];
    const validKeys = new Set(['offer-a::term-a']);
    const synced = selectionReducer(state, {
      type: SELECTION_ACTIONS.SYNC_WITH_OFFERS,
      payload: { validKeys },
    });
    expect(synced).toEqual([{ offerId: 'offer-a', termId: 'term-a' }]);

    const fallback = selectionReducer(state, {
      type: SELECTION_ACTIONS.SYNC_WITH_OFFERS,
      payload: {
        validKeys: new Set(),
        fallbackSelection: [
          { offerId: 'offer-c', termId: 'term-c' },
          { offerId: '', termId: '' },
        ],
      },
    });
    expect(fallback).toEqual([{ offerId: 'offer-c', termId: 'term-c' }]);
  });

  it('builds fallback selections from offers', () => {
    const offers = [
      { id: 'offer-1', terms: [{ id: 'term-1' }, { id: 'term-2' }] },
      { id: 'offer-2', terms: [] },
      { id: 'offer-3', terms: [{ id: 'term-3' }] },
    ];
    expect(createSelectionFallback(offers)).toEqual([
      { offerId: 'offer-1', termId: 'term-1' },
      { offerId: 'offer-3', termId: 'term-3' },
    ]);
  });
});

describe('queueAlertsReducer', () => {
  it('normalizes alerts and limits the list to three entries', () => {
    const alerts = [
      { payload: { message: 'Erro A', instanceId: 'one', reason: 'A1' } },
      { payload: { instanceId: 'two' } },
      null,
      { payload: { message: 'Extra', instanceId: 'three' } },
    ];
    const result = queueAlertsReducer([], {
      type: QUEUE_ALERTS_ACTIONS.SYNC,
      payload: { alerts, fallbackMessage: 'Fallback message' },
    });
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ message: 'Erro A', instanceId: 'one', reason: 'A1' });
    expect(result[1]).toMatchObject({ message: 'Fallback message', instanceId: 'two' });
    expect(result[2]).toMatchObject({ message: 'Fallback message' });
  });

  it('returns an empty array when payload is invalid', () => {
    const result = queueAlertsReducer([], {
      type: QUEUE_ALERTS_ACTIONS.SYNC,
      payload: { alerts: null },
    });
    expect(result).toEqual([]);
  });
});
