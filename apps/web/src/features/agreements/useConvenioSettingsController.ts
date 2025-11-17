import { useMemo } from 'react';
import useAgreementSelection, {
  type AgreementSelectionState,
} from '@/features/agreements/hooks/useAgreementSelection.ts';
import useAgreementBasicActions from '@/features/agreements/hooks/useAgreementBasicActions.ts';
import useAgreementWindowActions from '@/features/agreements/hooks/useAgreementWindowActions.ts';
import useAgreementRateActions from '@/features/agreements/hooks/useAgreementRateActions.ts';
import useAgreementLifecycleActions from '@/features/agreements/hooks/useAgreementLifecycleActions.ts';
import useAgreementProviderActions from '@/features/agreements/hooks/useAgreementProviderActions.ts';
import useAgreementUpdateRunner from '@/features/agreements/hooks/useAgreementUpdateRunner.ts';
import { createHistoryEntryBuilder } from '@/features/agreements/domain/createHistoryEntryBuilder.ts';

import type { UseConvenioCatalogReturn } from './useConvenioCatalog.ts';
import type { TaxPayload, UpdateBasicPayload, WindowPayload } from './hooks/types.ts';

type ControllerState = AgreementSelectionState;

type ControllerActions = {
  setRole: (value: string) => void;
  setRequireApproval: (value: boolean) => void;
  refresh: UseConvenioCatalogReturn['refetch'];
  selectConvenio: (id: string | null) => void;
  createConvenio: () => Promise<string | null>;
  archiveConvenio: (id: string) => Promise<void>;
  updateBasic: (payload: UpdateBasicPayload) => Promise<void>;
  upsertWindow: (payload: WindowPayload) => Promise<void>;
  removeWindow: (windowId: string) => Promise<void>;
  upsertTax: (payload: TaxPayload) => Promise<void>;
  syncProvider: () => Promise<void>;
  cancelPending: () => void;
};

type ImportDialogState = {
  mutation: UseConvenioCatalogReturn['mutations']['importAgreements'];
};

export type UseConvenioSettingsControllerReturn = {
  state: ControllerState;
  actions: ControllerActions;
  helpers: ImportDialogState;
};

const useConvenioSettingsController = (): UseConvenioSettingsControllerReturn => {
  const selection = useAgreementSelection();

  const buildHistoryEntry = useMemo(
    () => createHistoryEntryBuilder(selection.context.historyAuthor),
    [selection.context.historyAuthor]
  );

  const runUpdate = useAgreementUpdateRunner({
    historyAuthor: selection.context.historyAuthor,
    role: selection.context.role,
    mutations: selection.context.mutations,
  });

  const { updateBasic } = useAgreementBasicActions({
    selected: selection.context.selected,
    locked: selection.context.locked,
    pendingAgreement: selection.context.pendingAgreement,
    setPendingAgreement: selection.context.setPendingAgreement,
    setSelectedId: selection.context.setSelectedId,
    runUpdate,
    buildHistoryEntry,
  });

  const { upsertWindow, removeWindow } = useAgreementWindowActions({
    selected: selection.context.selected,
    locked: selection.context.locked,
    buildHistoryEntry,
    historyAuthor: selection.context.historyAuthor,
    role: selection.context.role,
    mutations: selection.context.mutations,
  });

  const { upsertTax } = useAgreementRateActions({
    selected: selection.context.selected,
    locked: selection.context.locked,
    runUpdate,
    buildHistoryEntry,
  });

  const { archiveConvenio } = useAgreementLifecycleActions({
    convenios: selection.context.allAgreements,
    locked: selection.context.locked,
    runUpdate,
    buildHistoryEntry,
  });

  const { syncProvider } = useAgreementProviderActions({
    selected: selection.context.selected,
    locked: selection.context.locked,
    role: selection.context.role,
    mutations: selection.context.mutations,
  });

  return {
    state: selection.state,
    actions: {
      ...selection.actions,
      archiveConvenio,
      updateBasic,
      upsertWindow,
      removeWindow,
      upsertTax,
      syncProvider,
    },
    helpers: {
      mutation: selection.context.mutations.importAgreements,
    },
  };
};

export default useConvenioSettingsController;
