import { useCallback } from 'react';
import { toast } from 'sonner';
import emitAgreementsTelemetry from '@/features/agreements/utils/telemetry.ts';
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

    try {
      await mutations.syncProvider.mutateAsync({
        providerId,
        payload: { requestedBy: role, reason: 'manual-trigger' },
      });
      toast.success('Sincronização enviada para processamento');
      emitAgreementsTelemetry('agreements.sync.triggered', { agreementId: selected.id, providerId, role });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Falha ao acionar sincronização'));
    }
  }, [locked, mutations.syncProvider, role, selected]);

  return { syncProvider };
};

export default useAgreementProviderActions;
