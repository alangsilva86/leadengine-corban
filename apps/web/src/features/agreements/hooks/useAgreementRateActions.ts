import { useCallback } from 'react';

import type { Agreement } from '@/features/agreements/useConvenioCatalog.ts';
import agreementsLogger from '@/features/agreements/utils/agreementsLogger.ts';
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

      agreementsLogger.info('rate', 'pre', '📚 Passo didático: preparando a taxa para subir ao palco.', {
        action: 'upsert-rate',
        agreementId: selected.id,
        status: selected.status,
        taxId: payload.id,
        payload: { modalidade: payload.modalidade, produto: payload.produto },
      });

      try {
        await runUpdate({
          nextAgreement: next,
          toastMessage: 'Taxa salva com sucesso',
          telemetryEvent: 'agreements.rate.upserted',
          telemetryPayload: { modalidade: payload.modalidade, produto: payload.produto },
          note: entry.message,
        });

        agreementsLogger.info('rate', 'post', '🎉 Passo lúdico concluído: taxa registrada com brilho.', {
          action: 'upsert-rate',
          agreementId: selected.id,
          status: next.status,
          taxId: payload.id,
          result: 'success',
        });
      } catch (error) {
        agreementsLogger.error('rate', 'error', '⚠️ Intuição alertou um tropeço ao salvar a taxa.', {
          action: 'upsert-rate',
          agreementId: selected.id,
          status: selected.status,
          taxId: payload.id,
          result: 'failure',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [buildHistoryEntry, locked, runUpdate, selected]
  );

  return { upsertTax };
};

export default useAgreementRateActions;
