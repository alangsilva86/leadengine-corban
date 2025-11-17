import { useCallback } from 'react';
import { formatDate } from '@/features/agreements/convenioSettings.utils.ts';
import agreementsLogger from '@/features/agreements/utils/agreementsLogger.ts';

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

      const action = exists ? 'update-window' : 'create-window';

      agreementsLogger.info('window', 'pre', '📚 Passo didático: alinhando a janela temporal do convênio.', {
        action,
        agreementId: selected.id,
        windowId: payload.id,
        status: selected.status,
        payload: { label: payload.label, start: payload.start, end: payload.end },
      });

      try {
        await runUpdate({
          nextAgreement: next,
          toastMessage: 'Calendário salvo com sucesso',
          telemetryEvent: 'agreements.window.upserted',
          telemetryPayload: { windowId: payload.id, hasOverlap: false },
          note: entry.message,
        });

        agreementsLogger.info('window', 'post', '🎉 Passo lúdico concluído: janela registrada no calendário mágico.', {
          action,
          agreementId: selected.id,
          windowId: payload.id,
          status: next.status,
          result: 'success',
        });
      } catch (error) {
        agreementsLogger.error('window', 'error', '⚠️ Intuição alertou um tropeço ao salvar a janela.', {
          action,
          agreementId: selected.id,
          windowId: payload.id,
          status: selected.status,
          result: 'failure',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
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

      agreementsLogger.info('window', 'pre', '📚 Passo didático: preparando remoção da janela temporal.', {
        action: 'remove-window',
        agreementId: selected.id,
        windowId,
        status: selected.status,
      });

      try {
        await runUpdate({
          nextAgreement: next,
          toastMessage: 'Janela removida',
          telemetryEvent: 'agreements.window.removed',
          telemetryPayload: { windowId },
          note: entry.message,
        });

        agreementsLogger.info('window', 'post', '🎉 Passo lúdico concluído: janela removida do mapa temporal.', {
          action: 'remove-window',
          agreementId: selected.id,
          windowId,
          status: next.status,
          result: 'success',
        });
      } catch (error) {
        agreementsLogger.error('window', 'error', '⚠️ Intuição alertou um tropeço ao remover a janela.', {
          action: 'remove-window',
          agreementId: selected.id,
          windowId,
          status: selected.status,
          result: 'failure',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [buildHistoryEntry, locked, runUpdate, selected]
  );

  return { upsertWindow, removeWindow };
};

export default useAgreementWindowActions;
