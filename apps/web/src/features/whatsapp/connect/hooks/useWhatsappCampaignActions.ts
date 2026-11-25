import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { createCampaignSchema } from '../schemas';
import {
  createCampaign as createCampaignRequest,
  deleteCampaign as deleteCampaignRequest,
  fetchCampaigns,
  fetchCampaignImpact,
  reassignCampaign as reassignCampaignRequest,
  renameCampaign as renameCampaignRequest,
  updateCampaignStatus as updateCampaignStatusRequest,
} from '../services/campaignService';
import type { CampaignActionState, CampaignState, CampaignStateAction } from '../../campaigns/campaignState';
import { resolveWhatsAppError } from '../../lib/errors';

/** Regras listadas na tela (encerradas aparecem no histórico da origem). */
const LISTED_STATUSES = ['active', 'paused', 'draft'];

const friendlyMessage = (err: any, fallbackTitle: string) => resolveWhatsAppError(err, fallbackTitle).message;

interface UseWhatsappCampaignActionsParams {
  state: CampaignState;
  dispatch: (action: CampaignStateAction) => void;
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
    }: {
      preferredAgreementId?: string | null;
      preferredCampaignId?: string | null;
      preferredInstanceId?: string | null;
    } = {}) => {
      // Sem origem selecionada, listamos todas as regras da empresa da sessão.
      const agreementId = preferredAgreementId ?? selectedAgreement?.id ?? null;

      dispatch({ type: 'set-campaigns-loading', value: true });
      dispatch({ type: 'set-campaign-error', value: null });
      try {
        const items = await fetchCampaigns({ agreementId, statuses: LISTED_STATUSES });
        dispatch({ type: 'set-campaigns', value: items });

        if (preferredCampaignId) {
          const found = items.find((c) => c && c.id === preferredCampaignId) || null;
          dispatch({ type: 'set-campaign', value: found });
        }
      } catch (err: any) {
        if (err?.status === 401) {
          handleAuthFallback({ error: err });
        }
        dispatch({ type: 'set-campaign-error', value: friendlyMessage(err, 'Não foi possível carregar as regras') });
      } finally {
        dispatch({ type: 'set-campaigns-loading', value: false });
      }
    },
    [dispatch, handleAuthFallback, selectedAgreement?.id]
  );

  useEffect(() => {
    loadCampaignsRef.current = loadCampaigns;
  }, [loadCampaigns]);

  useEffect(() => {
    void loadCampaigns({
      preferredAgreementId: selectedAgreement?.id ?? null,
    });
  }, [loadCampaigns, selectedAgreement?.id]);

  const reloadCampaigns = useCallback(() => {
    return loadCampaigns({
      preferredAgreementId: selectedAgreement?.id ?? null,
      preferredCampaignId: state.campaign?.id ?? null,
    });
  }, [loadCampaigns, selectedAgreement?.id, state.campaign?.id]);

  const createCampaign = useCallback(
    async ({
      name,
      instanceId,
      agreementId,
      agreementName,
      leadSource,
      product,
      margin,
      strategy,
      status: requestedStatus = 'active',
      segments,
    }: {
      name: string;
      instanceId: string;
      agreementId: string;
      agreementName: string;
      leadSource: string;
      product: string;
      margin: number;
      strategy: string;
      segments?: string[];
      status?: string;
    }) => {
      const parsed = createCampaignSchema.safeParse({
        name,
        instanceId,
        agreementId,
        agreementName,
        leadSource,
        product,
        margin,
        strategy,
        status: requestedStatus,
        segments,
      });
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Falha ao validar os dados da regra.';
        throw new Error(message);
      }

      const targetInstance = instances.find((entry) => entry && entry.id === parsed.data.instanceId) ?? null;
      if (!targetInstance) {
        const message = 'Escolha um número de WhatsApp para a regra.';
        throw new Error(message);
      }
      if (!targetInstance.connected) {
        const message = 'O número escolhido precisa estar conectado para receber leads.';
        throw new Error(message);
      }
      const brokerId =
        targetInstance && targetInstance.metadata && typeof targetInstance.metadata === 'object'
          ? targetInstance.metadata.brokerId || targetInstance.metadata.broker_id || null
          : null;

      const resolvedAgreementId = parsed.data.agreementId;
      const resolvedAgreementName = parsed.data.agreementName || agreementName || selectedAgreement?.name || '';

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
          leadSource: parsed.data.leadSource,
          productType: parsed.data.productType,
          marginType: parsed.data.marginType,
          marginValue: parsed.data.marginValue,
          strategy: parsed.data.strategy,
          ...(parsed.data.leadSource ? { leadSource: parsed.data.leadSource } : {}),
          ...(parsed.data.segments ? { segments: parsed.data.segments } : {}),
          ...(parsed.data.tags ? { tags: parsed.data.tags } : {}),
        });

        await loadCampaignsRef.current?.({
          preferredAgreementId: resolvedAgreementId,
          preferredCampaignId: payload?.id ?? null,
          preferredInstanceId: payload?.instanceId ?? instance?.id ?? null,
        });
        toast.success('Regra de roteamento criada.');
        return payload;
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message = friendlyMessage(err, 'Não foi possível criar a regra');
        logError('Falha ao criar regra WhatsApp', err);
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

      dispatch({ type: 'set-campaign-action', value: { id: target.id, type: nextStatus } });

      try {
        await updateCampaignStatusRequest(target.id, nextStatus);

        await loadCampaignsRef.current?.({
          preferredAgreementId: selectedAgreement?.id ?? null,
          preferredCampaignId: target?.id ?? null,
          preferredInstanceId: target?.instanceId ?? instance?.id ?? null,
        });
        toast.success(nextStatus === 'active' ? 'Regra retomada.' : 'Regra pausada. Novos leads desta origem não serão distribuídos.');
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message = friendlyMessage(err, 'Não foi possível atualizar a regra');
        toast.error('Não foi possível atualizar a regra', { description: message });
        logError('Falha ao atualizar status da regra', err);
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

      dispatch({ type: 'set-campaign-action', value: { id: target.id, type: 'delete' } });
      const currentCampaignId = state.campaign?.id ?? null;

      try {
        await deleteCampaignRequest(target.id);
        await loadCampaignsRef.current?.({
          preferredAgreementId: selectedAgreement?.id ?? null,
          preferredCampaignId: currentCampaignId === target.id ? null : currentCampaignId,
          preferredInstanceId: target?.instanceId ?? instance?.id ?? null,
        });
        toast.success('Regra encerrada. O histórico continua disponível.');
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message = friendlyMessage(err, 'Não foi possível encerrar a regra');
        toast.error('Não foi possível encerrar a regra', { description: message });
        logError('Falha ao remover regra WhatsApp', err);
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

      dispatch({ type: 'set-campaign-action', value: { id: target.id, type: 'reassign' } });

      try {
        await reassignCampaignRequest(target.id, requestedInstanceId ?? null);

        await loadCampaignsRef.current?.({
          preferredAgreementId: selectedAgreement?.id ?? null,
          preferredCampaignId: target?.id ?? null,
          preferredInstanceId: requestedInstanceId ?? instance?.id ?? null,
        });
        toast.success(requestedInstanceId ? 'Número da regra atualizado.' : 'Regra sem número por enquanto.');
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
          throw err;
        }

        const message = friendlyMessage(err, 'Não foi possível trocar o número');
        toast.error('Não foi possível trocar o número', { description: message });
        logError('Falha ao reatribuir regra WhatsApp', err);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        dispatch({ type: 'set-campaign-action', value: null });
      }
    },
    [dispatch, selectedAgreement?.id, instance?.id, handleAuthFallback, logError]
  );

  const renameCampaign = useCallback(
    async (target: any, nextName: string) => {
      const name = nextName.trim();
      if (!target?.id || !name) {
        return;
      }
      dispatch({ type: 'set-campaign-action', value: { id: target.id, type: 'rename' } });
      try {
        await renameCampaignRequest(target.id, name);
        await loadCampaignsRef.current?.({ preferredCampaignId: target.id });
        toast.success('Nome da regra atualizado.');
      } catch (err: any) {
        if (err?.payload?.status === 401 || err?.status === 401) {
          handleAuthFallback({ error: err });
        }
        const message = friendlyMessage(err, 'Não foi possível renomear a regra');
        toast.error('Não foi possível renomear a regra', { description: message });
        logError('Falha ao renomear regra WhatsApp', err);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        dispatch({ type: 'set-campaign-action', value: null });
      }
    },
    [dispatch, handleAuthFallback, logError]
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
    campaignsLoaded: state.campaignsLoaded,
    campaignError: state.campaignError,
    campaignAction: state.campaignAction as CampaignActionState | null,
    createCampaign,
    updateCampaignStatus,
    deleteCampaign,
    reassignCampaign,
    renameCampaign,
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
