import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import useSimulationCalculation from '../useSimulationCalculation.js';

const simulateConvenioDeal = vi.fn();

vi.mock('@/features/agreements/utils/dailyCoefficient.js', () => ({
  simulateConvenioDeal: (...args) => simulateConvenioDeal(...args),
}));

describe('useSimulationCalculation', () => {
  beforeEach(() => {
    simulateConvenioDeal.mockReset();
  });

  it('uses prefilled snapshot when calculation is disabled', () => {
    const prefilledSnapshot = {
      offers: [
        {
          id: 'prefilled',
          bankName: 'Banco Base',
          terms: [],
        },
      ],
      parameters: { baseType: 'margin', baseValue: 200 },
    };

    const { result } = renderHook(() =>
      useSimulationCalculation({
        convenio: null,
        productId: '',
        selectedTerms: [],
        baseValue: null,
        calculationMode: 'margin',
        simulationDate: new Date('2024-01-01'),
        simulationDateInput: '2024-01-01',
        activeWindow: null,
        activeTaxes: [],
        prefilledSnapshot,
      }),
    );

    expect(result.current.calculationEnabled).toBe(false);
    expect(result.current.visibleOffers).toEqual(prefilledSnapshot.offers);
    expect(result.current.currentParameters).toEqual(prefilledSnapshot.parameters);
  });

  it('calculates offers when enabled', () => {
    simulateConvenioDeal.mockImplementation(({ prazoMeses }) => ({
      installment: prazoMeses * 10,
      netAmount: prazoMeses * 100,
      grossAmount: prazoMeses * 120,
      coefficient: 0.9,
      tacValue: 5,
      details: {
        monthlyRate: 1,
        dailyRate: 0.1,
        graceDays: 0,
        presentValueUnit: 1,
        tacPercent: 0.1,
        tacFlat: 1,
      },
    }));

    const { result } = renderHook(() =>
      useSimulationCalculation({
        convenio: { id: 'conv-1' },
        productId: 'prod-1',
        selectedTerms: [12, 24],
        baseValue: 100,
        calculationMode: 'margin',
        simulationDate: new Date('2024-01-02'),
        simulationDateInput: '2024-01-02',
        activeWindow: { id: 'window-1', label: 'Especial' },
        activeTaxes: [
          {
            id: 'tax-1',
            bank: { id: 'bank-1', name: 'Banco XPTO' },
            table: { id: 'table-1', name: 'Tabela 1' },
            modalidade: 'Consignado',
            produto: 'Produto 1',
          },
        ],
        prefilledSnapshot: { offers: [], parameters: null },
      }),
    );

    expect(result.current.calculationEnabled).toBe(true);
    expect(simulateConvenioDeal).toHaveBeenCalledTimes(2);
    expect(result.current.calculationResult.offers).toHaveLength(1);
    expect(result.current.visibleOffers[0].terms).toHaveLength(2);
    expect(result.current.currentParameters?.baseValue).toBe(100);
  });
});
