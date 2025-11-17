import { useCallback } from 'react';
import { toast } from 'sonner';
import emitAgreementsTelemetry from '@/features/agreements/utils/telemetry.ts';
import agreementsLogger from '@/features/agreements/utils/agreementsLogger.ts';
import { getErrorMessage, resolveProviderId } from '@/features/agreements/convenioSettings.utils.ts';

import type { Agreement, UseConvenioCatalogReturn } from '@/features/agreements/useConvenioCatalog.ts';

type UseAgreementProviderActionsArgs = {
  selected: Agreement | null;
  locked: boolean;
  role: string;
  mutations: UseConvenioCatalogReturn['mutations'];
};

const useAgreementProviderActions = ({
  selected,
  locked,
  role,
  mutations,
}: UseAgreementProviderActionsArgs) => {
  const syncProvider = useCallback(async () => {
    if (!selected || locked) {
      return;
    }

    const providerId = resolveProviderId(selected.metadata);
    if (!providerId) {
      toast.error('Sincronização disponível apenas para convênios integrados.');
      return;
    }

    agreementsLogger.info('provider', 'pre', '📚 Passo didático: convocando sincronização mágica com o provedor.', {
      action: 'sync',
      agreementId: selected.id,
      providerId,
      status: selected.status,
      role,
    });

    try {
      await mutations.syncProvider.mutateAsync({
        providerId,
        payload: { requestedBy: role, reason: 'manual-trigger' },
      });
      toast.success('Sincronização enviada para processamento');
      emitAgreementsTelemetry('agreements.sync.triggered', { agreementId: selected.id, providerId, role });
      agreementsLogger.info('provider', 'post', '🎉 Passo lúdico concluído: sincronização enviada para o provedor.', {
        action: 'sync',
        agreementId: selected.id,
        providerId,
        status: selected.status,
        role,
        result: 'success',
      });
    } catch (err) {
      agreementsLogger.error('provider', 'error', '⚠️ Intuição alertou um tropeço durante a sincronização.', {
        action: 'sync',
        agreementId: selected.id,
        providerId,
        status: selected.status,
        role,
        result: 'failure',
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error(getErrorMessage(err, 'Falha ao acionar sincronização'));
    }
  }, [locked, mutations.syncProvider, role, selected]);

  return { syncProvider };
};

export default useAgreementProviderActions;
