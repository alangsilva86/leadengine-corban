import { useMemo } from 'react';
import { simulateConvenioDeal } from '@/features/agreements/utils/dailyCoefficient.js';

const getSortedTerms = (offers = []) => {
  if (!Array.isArray(offers) || offers.length === 0) {
    return [];
  }
  const sorted = [...offers].sort((a, b) => {
    const rankAValue = Number(a?.rank);
    const rankBValue = Number(b?.rank);
    const rankA = Number.isFinite(rankAValue) ? rankAValue : Number.MAX_SAFE_INTEGER;
    const rankB = Number.isFinite(rankBValue) ? rankBValue : Number.MAX_SAFE_INTEGER;
    if (rankA === rankB) {
      const bankA = typeof a?.bankName === 'string' ? a.bankName : '';
      const bankB = typeof b?.bankName === 'string' ? b.bankName : '';
      return bankA.localeCompare(bankB);
    }
    return rankA - rankB;
  });
  return sorted.slice(0, 3);
};

const useSimulationCalculation = ({
  convenio,
  productId,
  selectedTerms,
  baseValue,
  calculationMode,
  simulationDate,
  simulationDateInput,
  activeWindow,
  activeTaxes,
  prefilledSnapshot,
}) => {
  const normalizedSnapshot = prefilledSnapshot ?? { offers: [], parameters: null };
  const calculationEnabled =
    Boolean(convenio) &&
    Boolean(productId) &&
    Boolean(activeWindow) &&
    Array.isArray(activeTaxes) &&
    activeTaxes.length > 0 &&
    Array.isArray(selectedTerms) &&
    selectedTerms.length > 0 &&
    baseValue !== null;

  const calculationResult = useMemo(() => {
    if (!calculationEnabled) {
      return { offers: [], parameters: null, issues: [] };
    }

    const issues = [];
    const termList = selectedTerms;
    const offers = activeTaxes
      .map((tax, index) => {
        const offerId = tax?.id ?? `offer-${index + 1}`;
        const bankName = tax?.bank?.name ?? `Banco ${index + 1}`;
        const tableName = tax?.table?.name ?? tax?.modalidade ?? '';

        const terms = termList
          .map((term) => {
            try {
              const simulation = simulateConvenioDeal({
                margem: calculationMode === 'margin' ? baseValue : undefined,
                targetNetAmount: calculationMode === 'net' ? baseValue : undefined,
                prazoMeses: term,
                dataSimulacao: simulationDate,
                janela: activeWindow,
                taxa: tax,
              });

              return {
                id: `${offerId}-${term}`,
                term,
                installment: simulation.installment,
                netAmount: simulation.netAmount,
                totalAmount: simulation.grossAmount,
                coefficient: simulation.coefficient,
                tacValue: simulation.tacValue,
                source: 'auto',
                calculation: {
                  baseType: calculationMode,
                  baseValue,
                  simulationDate: simulationDateInput,
                  windowId: activeWindow?.id ?? null,
                  windowLabel: activeWindow?.label ?? null,
                  taxId: tax?.id ?? null,
                  modality: tax?.modalidade ?? null,
                  product: tax?.produto ?? null,
                  monthlyRate: simulation.details.monthlyRate,
                  dailyRate: simulation.details.dailyRate,
                  graceDays: simulation.details.graceDays,
                  presentValueUnit: simulation.details.presentValueUnit,
                  tacPercent: simulation.details.tacPercent,
                  tacFlat: simulation.details.tacFlat,
                },
                metadata: {
                  bankId: tax?.bank?.id ?? null,
                  tableId: tax?.table?.id ?? null,
                },
              };
            } catch (error) {
              issues.push({
                type: 'term_calculation',
                severity: 'warning',
                message: error instanceof Error ? error.message : 'Falha ao calcular condição.',
                context: `${bankName} • ${term} meses`,
              });
              return null;
            }
          })
          .filter(Boolean);

        if (terms.length === 0) {
          return null;
        }

        return {
          id: offerId,
          bankId: tax?.bank?.id ?? `bank-${index + 1}`,
          bankName,
          table: tableName,
          tableId: tax?.table?.id ?? '',
          taxId: tax?.id ?? '',
          modality: tax?.modalidade ?? '',
          rank: index + 1,
          source: 'auto',
          metadata: {
            produto: tax?.produto ?? null,
          },
          terms,
        };
      })
      .filter(Boolean);

    const parameters = {
      baseType: calculationMode,
      baseValue,
      simulationDate: simulationDateInput,
      windowId: activeWindow?.id ?? null,
      windowLabel: activeWindow?.label ?? null,
      termOptions: termList,
      taxIds: activeTaxes.map((tax) => tax?.id).filter(Boolean),
    };

    return { offers, parameters, issues };
  }, [
    activeTaxes,
    activeWindow,
    baseValue,
    calculationEnabled,
    calculationMode,
    selectedTerms,
    simulationDate,
    simulationDateInput,
  ]);

  const displayOffers = useMemo(() => {
    if (calculationResult.offers.length > 0) {
      return calculationResult.offers;
    }
    return normalizedSnapshot.offers ?? [];
  }, [calculationResult.offers, normalizedSnapshot.offers]);

  const visibleOffers = useMemo(() => {
    if (displayOffers.length === 0) {
      return [];
    }
    return getSortedTerms(displayOffers);
  }, [displayOffers]);

  const currentParameters = useMemo(() => {
    if (calculationResult.parameters) {
      return calculationResult.parameters;
    }
    return normalizedSnapshot.parameters ?? null;
  }, [calculationResult.parameters, normalizedSnapshot.parameters]);

  return { calculationEnabled, calculationResult, visibleOffers, currentParameters };
};

export default useSimulationCalculation;
