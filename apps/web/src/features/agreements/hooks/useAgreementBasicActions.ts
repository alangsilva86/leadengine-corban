import { useCallback } from 'react';
import { STATUS_OPTIONS } from '@/features/agreements/convenioSettings.constants.ts';

import type { Agreement } from '@/features/agreements/useConvenioCatalog.ts';
import type { BuildHistoryEntry, RunAgreementUpdate, UpdateBasicPayload } from './types.ts';

type UseAgreementBasicActionsArgs = {
  selected: Agreement | null;
  locked: boolean;
  pendingAgreement: Agreement | null;
  setPendingAgreement: (agreement: Agreement | null) => void;
  setSelectedId: (id: string | null) => void;
  runUpdate: RunAgreementUpdate;
  buildHistoryEntry: BuildHistoryEntry;
};

const useAgreementBasicActions = ({
  selected,
  locked,
  pendingAgreement,
  setPendingAgreement,
  setSelectedId,
  runUpdate,
  buildHistoryEntry,
}: UseAgreementBasicActionsArgs) => {
  const updateBasic = useCallback(
    async (payload: UpdateBasicPayload) => {
      if (!selected || locked) {
        return;
      }

      const entry = buildHistoryEntry(
        `Dados básicos atualizados: ${payload.nome} (${STATUS_OPTIONS.find((item) => item.value === payload.status)?.label ?? payload.status}).`
      );

      const next: Agreement = {
        ...selected,
        nome: payload.nome,
        averbadora: payload.averbadora,
        tipo: payload.tipo,
        status: payload.status,
        produtos: [...payload.produtos],
        responsavel: payload.responsavel,
        history: [entry, ...selected.history],
      };

      const isCreating = Boolean(pendingAgreement && pendingAgreement.id === selected.id);

      const response = await runUpdate({
        nextAgreement: next,
        toastMessage: isCreating ? 'Convênio criado com sucesso' : 'Dados básicos salvos com sucesso',
        telemetryEvent: isCreating ? 'agreements.created' : 'agreements.basic.updated',
        telemetryPayload: isCreating ? {} : { status: payload.status },
        note: entry.message,
        errorMessage: isCreating ? 'Falha ao criar convênio' : 'Falha ao atualizar dados básicos',
        action: isCreating ? 'create' : 'update',
      });

      if (isCreating && response?.id) {
        setPendingAgreement(null);
        setSelectedId(response.id);
      }
    },
    [buildHistoryEntry, locked, pendingAgreement, runUpdate, selected, setPendingAgreement, setSelectedId]
  );

  return { updateBasic };
};

export default useAgreementBasicActions;
