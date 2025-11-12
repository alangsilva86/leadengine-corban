import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { createCampaignSchema } from '../schemas';
import {
  createCampaign as createCampaignRequest,
  deleteCampaign as deleteCampaignRequest,
  fetchCampaigns,
  fetchCampaignImpact,
  reassignCampaign as reassignCampaignRequest,
  updateCampaignStatus as updateCampaignStatusRequest,
} from '../services/campaignService';
import type { CampaignActionState, WhatsAppConnectAction, WhatsAppConnectState } from '../useWhatsAppConnect';

interface UseWhatsappCampaignActionsParams {
  state: WhatsAppConnectState;
  dispatch: (action: WhatsAppConnectAction) => void;
  selectedAgreement: any;
  activeCampaign: any | undefined;
  instance: any;
  instances: any[];
  handleAuthFallback: (options: { error: any }) => void;
  logError: (message: string, error: any) => void;
  onCampaignReady?: (campaign: any | null) => void;
}

const useWhatsappCampaignActions = ({
  state,
  dispatch,
  selectedAgreement,
  activeCampaign,
  instance,
  instances,
  handleAuthFallback,
  logError,
  onCampaignReady,
}: UseWhatsappCampaignActionsParams) => {
  useEffect(() => {
    dispatch({ type: 'set-campaign', value: activeCampaign ?? null });
  }, [activeCampaign, dispatch]);

  useEffect(() => {
    if (!selectedAgreement) {
      dispatch({ type: 'set-campaign', value: null });
    }
  }, [selectedAgreement?.id, dispatch]);

  useEffect(() => {
    if (!state.campaign || !onCampaignReady) {
      return;
    }
    onCampaignReady(state.campaign);
  }, [state.campaign, onCampaignReady]);

  const loadCampaignsRef = useRef<
    (options?: {
      preferredAgreementId?: string | null;
      preferredCampaignId?: string | null;
      preferredInstanceId?: string | null;
    }) => Promise<void>
  >(() => Promise.resolve());

  const loadCampaigns = useCallback(
    async ({
      preferredAgreementId,
      preferredCampaignId,
      preferredInstanceId,
    }: {
      preferredAgreementId?: string | null;
      preferredCampaignId?: string | null;
      preferredInstanceId?: string | null;
    } = {}) => {
      const agreementId = preferredAgreementId ?? selectedAgreement?.id ?? null;

      if (!agreementId) {
        dispatch({ type: 'set-campaigns', value: [] });
        dispatch({ type: 'set-campaign-error', value: null });
        return;
      }

      dispatch({ type: 'set-campaigns-loading', value: true });
      dispatch({ type: 'set-campaign-error', value: null });
      try {
        const items = await fetchCampaigns({ agreementId, instanceId: preferredInstanceId ?? undefined });
        dispatch({ type: 'set-campaigns', value: items });

        if (preferredCampaignId) {
          const found = items.find((c) => c && c.id === preferredCampaignId) || null;
          dispatch({ type: 'set-campaign', value: found });
        }
      } catch (err: any) {
        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Falha ao carregar campanhas');
        dispatch({ type: 'set-campaign-error', value: message });
      } finally {
        dispatch({ type: 'set-campaigns-loading', value: false });
      }
    },
    [dispatch, selectedAgreement?.id]
  );

  useEffect(() => {
    loadCampaignsRef.current = loadCampaigns;
  }, [loadCampaigns]);

  useEffect(() => {
    void loadCampaigns({
      preferredAgreementId: selectedAgreement?.id ?? null,
      preferredCampaignId: state.campaign?.id ?? null,
      preferredInstanceId: instance?.id ?? null,
    });
  }, [loadCampaigns, selectedAgreement?.id, instance?.id, state.campaign?.id]);

  const reloadCampaigns = useCallback(() => {
    return loadCampaigns({
      preferredAgreementId: selectedAgreement?.id ?? null,
      preferredCampaignId: state.campaign?.id ?? null,
      preferredInstanceId: instance?.id ?? null,
    });
  }, [loadCampaigns, selectedAgreement?.id, state.campaign?.id, instance?.id]);

  const createCampaign = useCallback(
    async ({
      name,
      instanceId,
      agreementId,
      agreementName,
      product,
      margin,
      strategy,
      status: requestedStatus = 'active',
    }: {
      name: string;
      instanceId: string;
      agreementId: string;
      agreementName: string;
      product: string;
      margin: number;
      strategy: string;
      status?: string;
    }) => {
      const parsed = createCampaignSchema.safeParse({
        name,
        instanceId,
        agreementId,
        agreementName,
        product,
        margin,
        strategy,
        status: requestedStatus,
      });
      if (!parsed.success) {
        const message = parsed.error.errors[0]?.message ?? 'Falha ao validar os dados da campanha.';
        dispatch({ type: 'set-campaign-error', value: message });
        throw new Error(message);
      }

      const targetInstance = instances.find((entry) => entry && entry.id === parsed.data.instanceId) ?? null;
      if (!targetInstance) {
        const message = 'Selecione uma instância válida para criar a campanha.';
        dispatch({ type: 'set-campaign-error', value: message });
        throw new Error(message);
      }
      if (!targetInstance.connected) {
        const message = 'A campanha exige uma instância conectada para receber leads.';
        dispatch({ type: 'set-campaign-error', value: message });
        throw new Error(message);
      }
      const brokerId =
        targetInstance && targetInstance.metadata && typeof targetInstance.metadata === 'object'
          ? targetInstance.metadata.brokerId || targetInstance.metadata.broker_id || null
          : null;

      const resolvedAgreementId = parsed.data.agreementId;
      const resolvedAgreementName = parsed.data.agreementName || agreementName || selectedAgreement?.name || '';

      dispatch({ type: 'set-campaign-error', value: null });
      dispatch({ type: 'set-campaign-action', value: { id: null, type: 'create' } });

      try {
        const payload = await createCampaignRequest({
          agreementId: resolvedAgreementId,
          agreementName: resolvedAgreementName || null,
          instanceId: parsed.data.instanceId,
          ...(brokerId ? { brokerId } : {}),
          name:
            parsed.data.name ||
            resolvedAgreementName ||
            `${resolvedAgreementId} • ${parsed.data.instanceId}`,
          status: parsed.data.status,
          productType: parsed.data.productType,
          marginType: parsed.data.marginType,
          marginValue: parsed.data.marginValue,
          strategy: parsed.data.strategy,
          ...(parsed.data.tags ? { tags: parsed.data.tags } : {}),
        });

        await loadCampaignsRef.current?.({
          preferredAgreementId: resolvedAgreementId,
          preferredCampaignId: payload?.id ?? null,
          preferredInstanceId: payload?.instanceId ?? instance?.id ?? null,
        });
        toast.success('Campanha criada com sucesso.');
        return payload;
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível criar a campanha');
        dispatch({ type: 'set-campaign-error', value: message });
        logError('Falha ao criar campanha WhatsApp', err);
        toast.error('Falha ao criar campanha', { description: message });
        throw err instanceof Error ? err : new Error(message);
      } finally {
        dispatch({ type: 'set-campaign-action', value: null });
      }
    },
    [dispatch, instances, instance?.id, handleAuthFallback, logError, selectedAgreement?.name]
  );

  const updateCampaignStatus = useCallback(
    async (target: any, nextStatus: string) => {
      if (!target?.id) {
        return;
      }

      dispatch({ type: 'set-campaign-error', value: null });
      dispatch({ type: 'set-campaign-action', value: { id: target.id, type: nextStatus } });

      try {
        await updateCampaignStatusRequest(target.id, nextStatus);

        await loadCampaignsRef.current?.({
          preferredAgreementId: selectedAgreement?.id ?? null,
          preferredCampaignId: target?.id ?? null,
          preferredInstanceId: target?.instanceId ?? instance?.id ?? null,
        });
        toast.success(nextStatus === 'active' ? 'Campanha ativada com sucesso.' : 'Campanha pausada.');
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível atualizar a campanha');
        dispatch({ type: 'set-campaign-error', value: message });
        toast.error('Falha ao atualizar campanha', { description: message });
        logError('Falha ao atualizar status da campanha', err);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        dispatch({ type: 'set-campaign-action', value: null });
      }
    },
    [dispatch, selectedAgreement?.id, instance?.id, handleAuthFallback, logError]
  );

  const deleteCampaign = useCallback(
    async (target: any) => {
      if (!target?.id) {
        return;
      }

      dispatch({ type: 'set-campaign-error', value: null });
      dispatch({ type: 'set-campaign-action', value: { id: target.id, type: 'delete' } });
      const currentCampaignId = state.campaign?.id ?? null;

      try {
        await deleteCampaignRequest(target.id);
        await loadCampaignsRef.current?.({
          preferredAgreementId: selectedAgreement?.id ?? null,
          preferredCampaignId: currentCampaignId === target.id ? null : currentCampaignId,
          preferredInstanceId: target?.instanceId ?? instance?.id ?? null,
        });
        toast.success('Campanha removida com sucesso.');
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível remover a campanha');
        dispatch({ type: 'set-campaign-error', value: message });
        toast.error('Falha ao remover campanha', { description: message });
        logError('Falha ao remover campanha WhatsApp', err);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        dispatch({ type: 'set-campaign-action', value: null });
      }
    },
    [dispatch, selectedAgreement?.id, instance?.id, handleAuthFallback, logError, state.campaign?.id]
  );

  const reassignCampaign = useCallback(
    async (target: any, requestedInstanceId: string | null) => {
      if (!target?.id) {
        return;
      }

      dispatch({ type: 'set-campaign-error', value: null });
      dispatch({ type: 'set-campaign-action', value: { id: target.id, type: 'reassign' } });

      try {
        await reassignCampaignRequest(target.id, requestedInstanceId ?? null);

        await loadCampaignsRef.current?.({
          preferredAgreementId: selectedAgreement?.id ?? null,
          preferredCampaignId: target?.id ?? null,
          preferredInstanceId: requestedInstanceId ?? instance?.id ?? null,
        });
        toast.success(
          requestedInstanceId
            ? 'Campanha reatribuída com sucesso.'
            : 'Campanha desvinculada da instância.'
        );
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível reatribuir a campanha');
        dispatch({ type: 'set-campaign-error', value: message });
        toast.error('Falha ao reatribuir campanha', { description: message });
        logError('Falha ao reatribuir campanha WhatsApp', err);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        dispatch({ type: 'set-campaign-action', value: null });
      }
    },
    [dispatch, selectedAgreement?.id, instance?.id, handleAuthFallback, logError]
  );

  const setCreateCampaignOpen = useCallback(
    (value: boolean) => dispatch({ type: 'set-create-campaign-open', value }),
    [dispatch]
  );

  const setPendingReassign = useCallback(
    (value: any) => dispatch({ type: 'set-pending-reassign', value }),
    [dispatch]
  );

  const setReassignIntent = useCallback(
    (value: 'reassign' | 'disconnect') => dispatch({ type: 'set-reassign-intent', value }),
    [dispatch]
  );

  const clearCampaign = useCallback(() => {
    dispatch({ type: 'set-campaign', value: null });
  }, [dispatch]);

  return {
    campaign: state.campaign,
    campaigns: state.campaigns,
    campaignsLoading: state.campaignsLoading,
    campaignError: state.campaignError,
    campaignAction: state.campaignAction as CampaignActionState | null,
    createCampaign,
    updateCampaignStatus,
    deleteCampaign,
    reassignCampaign,
    reloadCampaigns,
    fetchCampaignImpact,
    setCreateCampaignOpen,
    isCreateCampaignOpen: state.isCreateCampaignOpen,
    setPendingReassign,
    pendingReassign: state.pendingReassign,
    setReassignIntent,
    reassignIntent: state.reassignIntent,
    persistentWarning: state.persistentWarning,
    clearCampaign,
  };
};

export default useWhatsappCampaignActions;
