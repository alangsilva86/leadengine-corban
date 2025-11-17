import { useCallback } from 'react';
import { toast } from 'sonner';
import { formatDate, getErrorMessage } from '@/features/agreements/convenioSettings.utils.ts';
import agreementsLogger from '@/features/agreements/utils/agreementsLogger.ts';
import emitAgreementsTelemetry from '@/features/agreements/utils/telemetry.ts';
import { buildAgreementWindowRequest } from '@/features/agreements/domain/buildAgreementWindowRequest.ts';

import type { Agreement, UseConvenioCatalogReturn } from '@/features/agreements/useConvenioCatalog.ts';
import type { BuildHistoryEntry, WindowPayload } from './types.ts';

type UseAgreementWindowActionsArgs = {
  selected: Agreement | null;
  locked: boolean;
  buildHistoryEntry: BuildHistoryEntry;
  historyAuthor: string;
  role: string;
  mutations: Pick<UseConvenioCatalogReturn['mutations'], 'upsertWindow' | 'removeWindow'>;
};

const useAgreementWindowActions = ({
  selected,
  locked,
  buildHistoryEntry,
  historyAuthor,
  role,
  mutations,
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

      const request = buildAgreementWindowRequest({
        window: payload,
        actor: historyAuthor,
        actorRole: role,
        note: entry.message,
      });

      const action = exists ? 'update-window' : 'create-window';

      agreementsLogger.info('window', 'pre', '📚 Passo didático: alinhando a janela temporal do convênio.', {
        action,
        agreementId: selected.id,
        windowId: payload.id,
        status: selected.status,
        payload: { label: payload.label, start: payload.start, end: payload.end },
      });

      try {
        await mutations.upsertWindow.mutateAsync({
          agreementId: selected.id,
          payload: request,
        });
        toast.success('Calendário salvo com sucesso');
        emitAgreementsTelemetry('agreements.window.upserted', {
          windowId: payload.id,
          hasOverlap: false,
          agreementId: selected.id,
          role,
        });

        agreementsLogger.info('window', 'post', '🎉 Passo lúdico concluído: janela registrada no calendário mágico.', {
          action,
          agreementId: selected.id,
          windowId: payload.id,
          status: selected.status,
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
        toast.error(getErrorMessage(error, 'Falha ao salvar janela'));
        throw error;
      }
    },
    [buildHistoryEntry, historyAuthor, locked, mutations.upsertWindow, role, selected]
  );

  const removeWindow = useCallback(
    async (windowId: string) => {
      if (!selected || locked) {
        return;
      }

      const entry = buildHistoryEntry('Janela removida do calendário.');

      const meta = {
        audit: {
          actor: historyAuthor,
          actorRole: role,
          note: entry.message,
        },
      } satisfies ReturnType<typeof buildAgreementWindowRequest>['meta'];

      agreementsLogger.info('window', 'pre', '📚 Passo didático: preparando remoção da janela temporal.', {
        action: 'remove-window',
        agreementId: selected.id,
        windowId,
        status: selected.status,
      });

      try {
        await mutations.removeWindow.mutateAsync({
          agreementId: selected.id,
          windowId,
          meta,
        });
        toast.success('Janela removida');
        emitAgreementsTelemetry('agreements.window.removed', {
          agreementId: selected.id,
          windowId,
          role,
        });

        agreementsLogger.info('window', 'post', '🎉 Passo lúdico concluído: janela removida do mapa temporal.', {
          action: 'remove-window',
          agreementId: selected.id,
          windowId,
          status: selected.status,
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
        toast.error(getErrorMessage(error, 'Falha ao remover janela'));
        throw error;
      }
    },
    [buildHistoryEntry, historyAuthor, locked, mutations.removeWindow, role, selected]
  );

  return { upsertWindow, removeWindow };
};

export default useAgreementWindowActions;
