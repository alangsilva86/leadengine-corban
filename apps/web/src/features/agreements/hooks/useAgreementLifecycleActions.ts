import { useCallback } from 'react';

import type { Agreement } from '@/features/agreements/useConvenioCatalog.ts';
import agreementsLogger from '@/features/agreements/utils/agreementsLogger.ts';
import type { BuildHistoryEntry, RunAgreementUpdate } from './types.ts';

type UseAgreementLifecycleActionsArgs = {
  convenios: Agreement[];
  locked: boolean;
  runUpdate: RunAgreementUpdate;
  buildHistoryEntry: BuildHistoryEntry;
};

const useAgreementLifecycleActions = ({
  convenios,
  locked,
  runUpdate,
  buildHistoryEntry,
}: UseAgreementLifecycleActionsArgs) => {
  const archiveConvenio = useCallback(
    async (convenioId: string) => {
      const target = convenios.find((item) => item.id === convenioId);
      if (!target || locked) {
        return;
      }

      const entry = buildHistoryEntry('Convênio arquivado pelo gestor.');
      const next: Agreement = {
        ...target,
        archived: true,
        status: target.status === 'ATIVO' ? 'PAUSADO' : target.status,
        history: [entry, ...target.history],
      };

      agreementsLogger.info('lifecycle', 'pre', '📚 Passo didático: arquivando convênio com cuidado artesanal.', {
        action: 'archive',
        agreementId: target.id,
        status: target.status,
      });

      try {
        await runUpdate({
          nextAgreement: next,
          toastMessage: 'Convênio arquivado',
          telemetryEvent: 'agreements.archived',
          telemetryPayload: {},
          note: entry.message,
          errorMessage: 'Falha ao arquivar convênio',
        });

        agreementsLogger.info('lifecycle', 'post', '🎉 Passo lúdico concluído: convênio repousando no arquivo encantado.', {
          action: 'archive',
          agreementId: target.id,
          status: next.status,
          result: 'success',
        });
      } catch (error) {
        agreementsLogger.error('lifecycle', 'error', '⚠️ Intuição alertou um tropeço ao arquivar o convênio.', {
          action: 'archive',
          agreementId: target.id,
          status: target.status,
          result: 'failure',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [buildHistoryEntry, convenios, locked, runUpdate]
  );

  return { archiveConvenio };
};

export default useAgreementLifecycleActions;
