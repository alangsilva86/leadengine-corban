import { useCallback } from 'react';

import type { Agreement } from '@/features/agreements/useConvenioCatalog.ts';
import type { BuildHistoryEntry, RunAgreementUpdate, TaxPayload } from './types.ts';

type UseAgreementRateActionsArgs = {
  selected: Agreement | null;
  locked: boolean;
  runUpdate: RunAgreementUpdate;
  buildHistoryEntry: BuildHistoryEntry;
};

const useAgreementRateActions = ({
  selected,
  locked,
  runUpdate,
  buildHistoryEntry,
}: UseAgreementRateActionsArgs) => {
  const upsertTax = useCallback(
    async (payload: TaxPayload) => {
      if (!selected || locked) {
        return;
      }

      const exists = selected.taxas.some((tax) => tax.id === payload.id);
      const taxas = exists
        ? selected.taxas.map((tax) => (tax.id === payload.id ? payload : tax))
        : [...selected.taxas, payload];

      const entry = buildHistoryEntry(
        `${payload.modalidade} atualizado para ${payload.monthlyRate?.toFixed(2)}% (${payload.produto}).`
      );

      const next: Agreement = {
        ...selected,
        taxas,
        history: [entry, ...selected.history],
      };

      await runUpdate({
        nextAgreement: next,
        toastMessage: 'Taxa salva com sucesso',
        telemetryEvent: 'agreements.rate.upserted',
        telemetryPayload: { modalidade: payload.modalidade, produto: payload.produto },
        note: entry.message,
      });
    },
    [buildHistoryEntry, locked, runUpdate, selected]
  );

  return { upsertTax };
};

export default useAgreementRateActions;
