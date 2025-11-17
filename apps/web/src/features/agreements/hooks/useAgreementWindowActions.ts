import { useCallback } from 'react';
import { formatDate } from '@/features/agreements/convenioSettings.utils.ts';

import type { Agreement } from '@/features/agreements/useConvenioCatalog.ts';
import type { BuildHistoryEntry, RunAgreementUpdate, WindowPayload } from './types.ts';

type UseAgreementWindowActionsArgs = {
  selected: Agreement | null;
  locked: boolean;
  runUpdate: RunAgreementUpdate;
  buildHistoryEntry: BuildHistoryEntry;
};

const useAgreementWindowActions = ({
  selected,
  locked,
  runUpdate,
  buildHistoryEntry,
}: UseAgreementWindowActionsArgs) => {
  const upsertWindow = useCallback(
    async (payload: WindowPayload) => {
      if (!selected || locked) {
        return;
      }

      const exists = selected.janelas.some((window) => window.id === payload.id);
      const janelas = exists
        ? selected.janelas.map((window) => (window.id === payload.id ? payload : window))
        : [...selected.janelas, payload];

      const entry = buildHistoryEntry(
        `Janela ${payload.label} ${exists ? 'atualizada' : 'cadastrada'} (${formatDate(payload.start)} até ${formatDate(payload.end)}).`
      );

      const next: Agreement = {
        ...selected,
        janelas,
        history: [entry, ...selected.history],
      };

      await runUpdate({
        nextAgreement: next,
        toastMessage: 'Calendário salvo com sucesso',
        telemetryEvent: 'agreements.window.upserted',
        telemetryPayload: { windowId: payload.id, hasOverlap: false },
        note: entry.message,
      });
    },
    [buildHistoryEntry, locked, runUpdate, selected]
  );

  const removeWindow = useCallback(
    async (windowId: string) => {
      if (!selected || locked) {
        return;
      }

      const entry = buildHistoryEntry('Janela removida do calendário.');
      const next: Agreement = {
        ...selected,
        janelas: selected.janelas.filter((window) => window.id !== windowId),
        history: [entry, ...selected.history],
      };

      await runUpdate({
        nextAgreement: next,
        toastMessage: 'Janela removida',
        telemetryEvent: 'agreements.window.removed',
        telemetryPayload: { windowId },
        note: entry.message,
      });
    },
    [buildHistoryEntry, locked, runUpdate, selected]
  );

  return { upsertWindow, removeWindow };
};

export default useAgreementWindowActions;
