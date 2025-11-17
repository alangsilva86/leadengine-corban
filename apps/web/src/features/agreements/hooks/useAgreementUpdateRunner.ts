import { useCallback } from 'react';
import { toast } from 'sonner';
import emitAgreementsTelemetry from '@/features/agreements/utils/telemetry.ts';
import { buildAgreementPayload } from '@/features/agreements/domain/buildAgreementPayload.ts';
import { getErrorMessage } from '@/features/agreements/convenioSettings.utils.ts';

import type { UseConvenioCatalogReturn } from '@/features/agreements/useConvenioCatalog.ts';
import type { RunAgreementUpdate, RunAgreementUpdateArgs } from './types.ts';

type UseAgreementUpdateRunnerArgs = {
  historyAuthor: string;
  role: string;
  mutations: UseConvenioCatalogReturn['mutations'];
};

const useAgreementUpdateRunner = ({
  historyAuthor,
  role,
  mutations,
}: UseAgreementUpdateRunnerArgs): RunAgreementUpdate =>
  useCallback(
    async ({
      nextAgreement,
      toastMessage,
      telemetryEvent,
      telemetryPayload = {},
      note,
      errorMessage = 'Falha ao atualizar convênio',
      action = 'update',
    }: RunAgreementUpdateArgs) => {
      try {
        const payload = buildAgreementPayload({
          agreement: nextAgreement,
          actor: historyAuthor,
          actorRole: role,
          note,
        });

        const response =
          action === 'create'
            ? await mutations.createAgreement.mutateAsync({ payload })
            : await mutations.updateAgreement.mutateAsync({ agreementId: nextAgreement.id, payload });

        const agreementId = response?.data?.id ?? nextAgreement.id;
        toast.success(toastMessage);
        emitAgreementsTelemetry(telemetryEvent, { ...telemetryPayload, agreementId, role });
        return response?.data ?? null;
      } catch (err) {
        toast.error(getErrorMessage(err, errorMessage));
        throw err;
      }
    },
    [historyAuthor, mutations.createAgreement, mutations.updateAgreement, role]
  );

export default useAgreementUpdateRunner;
