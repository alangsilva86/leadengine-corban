import { useCallback } from 'react';

import type { Agreement } from '@/features/agreements/useConvenioCatalog.ts';
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

      await runUpdate({
        nextAgreement: next,
        toastMessage: 'Convênio arquivado',
        telemetryEvent: 'agreements.archived',
        telemetryPayload: {},
        note: entry.message,
        errorMessage: 'Falha ao arquivar convênio',
      });
    },
    [buildHistoryEntry, convenios, locked, runUpdate]
  );

  return { archiveConvenio };
};

export default useAgreementLifecycleActions;
