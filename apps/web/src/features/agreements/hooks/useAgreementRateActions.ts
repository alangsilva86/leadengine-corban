import { useCallback } from 'react';
import { toast } from 'sonner';
import emitAgreementsTelemetry from '@/features/agreements/utils/telemetry.ts';
import type { Agreement, UseConvenioCatalogReturn } from '@/features/agreements/useConvenioCatalog.ts';
import agreementsLogger from '@/features/agreements/utils/agreementsLogger.ts';
import type { BuildHistoryEntry, TaxPayload } from './types.ts';

type UseAgreementRateActionsArgs = {
  selected: Agreement | null;
  locked: boolean;
  buildHistoryEntry: BuildHistoryEntry;
  historyAuthor: string;
  role: string;
  mutations: Pick<UseConvenioCatalogReturn['mutations'], 'upsertRate'>;
};

const useAgreementRateActions = ({
  selected,
  locked,
  buildHistoryEntry,
  historyAuthor,
  role,
  mutations,
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
        await mutations.upsertRate.mutateAsync({
          agreementId: selected.id,
          payload: {
            data: {
              id: payload.id,
              product: payload.produto,
              modality: payload.modalidade,
              monthlyRate: payload.monthlyRate,
              tacPercentage: payload.tacPercent,
              metadata: {
                tacPercent: payload.tacPercent,
                tacFlat: payload.tacFlat,
                validFrom: payload.validFrom.toISOString(),
                validUntil: payload.validUntil ? payload.validUntil.toISOString() : null,
                status: next.status,
              },
            },
            meta: {
              audit: {
                actor: historyAuthor,
                actorRole: role,
                note: entry.message,
              },
            },
          },
        });

        const telemetryPayload = { modalidade: payload.modalidade, produto: payload.produto, agreementId: selected.id };
        emitAgreementsTelemetry('agreements.rate.upserted', telemetryPayload);
        toast.success('Taxa salva com sucesso');

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
    [buildHistoryEntry, historyAuthor, locked, mutations.upsertRate, role, selected]
  );

  return { upsertTax };
};

export default useAgreementRateActions;
