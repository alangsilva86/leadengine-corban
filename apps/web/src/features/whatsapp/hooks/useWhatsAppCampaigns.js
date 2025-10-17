import { useCallback, useEffect, useState } from 'react';

import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api.js';

const CAMPAIGN_STATUSES_QUERY = 'active,paused,draft,ended';

const isPlainRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const useWhatsAppCampaigns = ({
  agreement,
  instance,
  instances,
  activeCampaign = null,
  onCampaignReady,
  isAuthError,
  onAuthError,
  onSuccess,
  onError,
  warn,
  logError,
} = {}) => {
  const agreementId = agreement?.id ?? null;
  const instanceId = instance?.id ?? null;

  const [campaign, setCampaign] = useState(activeCampaign ?? null);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignError, setCampaignError] = useState(null);
  const [campaignAction, setCampaignAction] = useState(null);
  const [persistentWarning, setPersistentWarning] = useState(null);

  const notifySuccess = useCallback(
    (message, options) => {
      if (typeof onSuccess === 'function' && message) {
        onSuccess(message, options);
      }
    },
    [onSuccess]
  );

  const notifyError = useCallback(
    (message, options) => {
      if (typeof onError === 'function' && message) {
        onError(message, options);
      }
    },
    [onError]
  );

  useEffect(() => {
    setCampaign(activeCampaign ?? null);
  }, [activeCampaign]);

  useEffect(() => {
    if (!agreementId) {
      setCampaign(null);
      setPersistentWarning(null);
    }
  }, [agreementId]);

  const loadCampaigns = useCallback(
    async (options = {}) => {
      setCampaignsLoading(true);
      setCampaignError(null);

      try {
        const params = new URLSearchParams();
        params.set('status', CAMPAIGN_STATUSES_QUERY);

        const response = await apiGet(`/api/campaigns?${params.toString()}`);
        const entries = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.data)
          ? response.data
          : [];
        const list = entries.filter((entry) => entry?.status !== 'ended');

        setCampaigns(list);

        const {
          preferredAgreementId: preferredAgreementIdInput,
          preferredCampaignId: preferredCampaignIdInput,
          preferredInstanceId: preferredInstanceIdInput,
        } = options ?? {};

        const preferredAgreementId = preferredAgreementIdInput ?? agreementId ?? null;
        const preferredCampaignId = preferredCampaignIdInput ?? campaign?.id ?? null;
        const preferredInstanceId = preferredInstanceIdInput ?? instanceId ?? null;

        const scopedList = (() => {
          if (preferredAgreementId) {
            const matches = list.filter((entry) => entry.agreementId === preferredAgreementId);
            if (matches.length > 0) {
              return matches;
            }
          }
          return list;
        })();

        const selectionPool = scopedList.length > 0 ? scopedList : list;

        const findByInstance = (collection) => {
          if (!preferredInstanceId || !Array.isArray(collection) || collection.length === 0) {
            return null;
          }
          return (
            collection.find((entry) => entry.instanceId === preferredInstanceId && entry.status === 'active') ??
            collection.find((entry) => entry.instanceId === preferredInstanceId) ??
            null
          );
        };

        let resolvedPreferred = null;

        if (preferredCampaignId) {
          resolvedPreferred = list.find((entry) => entry.id === preferredCampaignId) ?? null;
        }

        if (!resolvedPreferred) {
          resolvedPreferred = findByInstance(selectionPool) ?? findByInstance(list);
        }

        if (!resolvedPreferred) {
          resolvedPreferred =
            selectionPool.find((entry) => entry.status === 'active') ??
            list.find((entry) => entry.status === 'active') ??
            selectionPool[0] ??
            list[0] ??
            null;
        }

        const nextId = resolvedPreferred?.id ?? null;
        const previousId = campaign?.id ?? null;

        if (nextId !== previousId) {
          setCampaign(resolvedPreferred ?? null);
          if (resolvedPreferred) {
            onCampaignReady?.(resolvedPreferred);
          }
        } else if (resolvedPreferred) {
          onCampaignReady?.(resolvedPreferred);
        }

        return { success: true, items: list, selectedCampaign: resolvedPreferred ?? null };
      } catch (err) {
        if (isAuthError?.(err)) {
          onAuthError?.({ error: err });
        } else {
          setCampaignError(err instanceof Error ? err.message : 'Não foi possível carregar campanhas');
        }
        return { success: false, error: err };
      } finally {
        setCampaignsLoading(false);
      }
    },
    [agreementId, campaign?.id, instanceId, isAuthError, onAuthError, onCampaignReady]
  );

  useEffect(() => {
    if (!agreementId) {
      return;
    }

    const scopedCampaigns = campaigns.filter((entry) => entry.agreementId === agreementId);

    if (!scopedCampaigns.length) {
      if (campaign?.agreementId === agreementId) {
        setCampaign(null);
      }
      setPersistentWarning(
        'Nenhuma campanha cadastrada para este convênio. Os leads continuarão chegando pela instância conectada; vincule uma campanha apenas se precisar de roteamento avançado.'
      );
      return;
    }

    if (campaign && campaign.agreementId !== agreementId) {
      setCampaign(null);
    }

    const activeForAgreement = scopedCampaigns.filter((entry) => entry.status === 'active');
    let warningMessage = null;

    if (activeForAgreement.length === 0) {
      warningMessage =
        'Nenhuma campanha ativa para este convênio. Os leads seguirão para a inbox, mas ative ou crie uma campanha se quiser roteamento avançado.';
    } else if (instanceId && !activeForAgreement.some((entry) => entry.instanceId === instanceId)) {
      warningMessage =
        'A instância selecionada não possui campanhas ativas. Os leads continuarão sendo entregues; vincule uma campanha para direcionar filas ou regras específicas.';
    }

    setPersistentWarning(warningMessage);

    if (instanceId) {
      const activeMatch = scopedCampaigns.find(
        (entry) => entry.instanceId === instanceId && entry.status === 'active'
      );
      if (activeMatch && activeMatch.id !== (campaign?.id ?? null)) {
        setCampaign(activeMatch);
        onCampaignReady?.(activeMatch);
        return;
      }

      const instanceMatch = scopedCampaigns.find((entry) => entry.instanceId === instanceId);
      if (instanceMatch && instanceMatch.id !== (campaign?.id ?? null)) {
        setCampaign(instanceMatch);
        onCampaignReady?.(instanceMatch);
        return;
      }
    }

    if (!campaign || campaign.agreementId !== agreementId) {
      const fallback =
        scopedCampaigns.find((entry) => entry.status === 'active') ?? scopedCampaigns[0] ?? null;
      if (fallback) {
        setCampaign(fallback);
        onCampaignReady?.(fallback);
      }
    }
  }, [agreementId, campaigns, campaign, instanceId, onCampaignReady]);

  const clearCampaignSelection = useCallback(() => {
    setCampaign(null);
  }, []);

  const createCampaign = useCallback(
    async ({ name, instanceId: requestedInstanceId, status = 'active' }) => {
      if (!agreementId) {
        throw new Error('Vincule um convênio antes de criar campanhas.');
      }

      const normalizedName = `${name ?? ''}`.trim();
      if (!requestedInstanceId) {
        const error = new Error('Escolha a instância que será vinculada à campanha.');
        setCampaignError(error.message);
        throw error;
      }

      const targetInstance =
        instances?.find((entry) => entry && entry.id === requestedInstanceId) ?? null;
      const brokerId =
        targetInstance && isPlainRecord(targetInstance.metadata)
          ? targetInstance.metadata.brokerId || targetInstance.metadata.broker_id || null
          : null;

      setCampaignError(null);
      setCampaignAction({ id: null, type: 'create' });

      try {
        const payload = await apiPost('/api/campaigns', {
          agreementId,
          agreementName: agreement?.name,
          instanceId: requestedInstanceId,
          ...(brokerId ? { brokerId } : {}),
          name: normalizedName || `${agreement?.name ?? 'Campanha'} • ${requestedInstanceId}`,
          status,
        });

        const createdCampaign = payload?.data ?? null;

        await loadCampaigns({
          preferredAgreementId: agreementId,
          preferredCampaignId: createdCampaign?.id ?? null,
          preferredInstanceId: createdCampaign?.instanceId ?? instanceId ?? null,
        });

        notifySuccess('Campanha criada com sucesso.');
        return createdCampaign;
      } catch (err) {
        if (isAuthError?.(err)) {
          onAuthError?.({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível criar a campanha');
        setCampaignError(message);
        logError?.('Falha ao criar campanha WhatsApp', err);
        notifyError('Falha ao criar campanha', { description: message });
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setCampaignAction(null);
      }
    },
    [agreement?.name, agreementId, instanceId, instances, isAuthError, loadCampaigns, logError, notifyError, notifySuccess, onAuthError]
  );

  const updateCampaignStatus = useCallback(
    async (target, nextStatus) => {
      if (!target?.id) {
        return;
      }

      setCampaignError(null);
      setCampaignAction({ id: target.id, type: nextStatus });

      try {
        await apiPatch(`/api/campaigns/${encodeURIComponent(target.id)}`, {
          status: nextStatus,
        });

        await loadCampaigns({
          preferredAgreementId: agreementId,
          preferredCampaignId: target?.id ?? null,
          preferredInstanceId: target?.instanceId ?? instanceId ?? null,
        });

        notifySuccess(
          nextStatus === 'active' ? 'Campanha ativada com sucesso.' : 'Campanha pausada.'
        );
      } catch (err) {
        if (isAuthError?.(err)) {
          onAuthError?.({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível atualizar a campanha');
        setCampaignError(message);
        notifyError('Falha ao atualizar campanha', { description: message });
        logError?.('Falha ao atualizar status da campanha', err);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setCampaignAction(null);
      }
    },
    [agreementId, instanceId, isAuthError, loadCampaigns, logError, notifyError, notifySuccess, onAuthError]
  );

  const deleteCampaign = useCallback(
    async (target) => {
      if (!target?.id) {
        return;
      }

      setCampaignError(null);
      setCampaignAction({ id: target.id, type: 'delete' });
      const currentCampaignId = campaign?.id ?? null;

      try {
        await apiDelete(`/api/campaigns/${encodeURIComponent(target.id)}`);
        await loadCampaigns({
          preferredAgreementId: agreementId,
          preferredCampaignId:
            currentCampaignId && currentCampaignId !== target.id ? currentCampaignId : null,
          preferredInstanceId: instanceId ?? null,
        });
        notifySuccess('Campanha encerrada com sucesso.');
      } catch (err) {
        if (isAuthError?.(err)) {
          onAuthError?.({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível encerrar a campanha');
        setCampaignError(message);
        notifyError('Falha ao encerrar campanha', { description: message });
        logError?.('Falha ao encerrar campanha WhatsApp', err);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setCampaignAction(null);
      }
    },
    [agreementId, campaign?.id, instanceId, isAuthError, loadCampaigns, logError, notifyError, notifySuccess, onAuthError]
  );

  const reassignCampaign = useCallback(
    async (target, nextInstanceId) => {
      if (!target?.id) {
        return;
      }

      const normalizedNext =
        typeof nextInstanceId === 'string'
          ? nextInstanceId.trim()
          : nextInstanceId === null
          ? null
          : undefined;
      const requestedInstanceId =
        normalizedNext === undefined ? null : normalizedNext === '' ? null : normalizedNext;
      const currentInstanceId = target.instanceId ?? null;

      if ((requestedInstanceId ?? null) === (currentInstanceId ?? null)) {
        const error = new Error(
          'Selecione uma opção diferente para concluir ou escolha desvincular a campanha.'
        );
        setCampaignError(error.message);
        throw error;
      }

      setCampaignError(null);
      setCampaignAction({ id: target.id, type: 'reassign' });

      try {
        await apiPatch(`/api/campaigns/${encodeURIComponent(target.id)}`, {
          instanceId: requestedInstanceId ?? null,
        });

        await loadCampaigns({
          preferredAgreementId: agreementId,
          preferredCampaignId: target?.id ?? null,
          preferredInstanceId: requestedInstanceId ?? instanceId ?? null,
        });
        notifySuccess(
          requestedInstanceId
            ? 'Campanha reatribuída com sucesso.'
            : 'Campanha desvinculada da instância.'
        );
      } catch (err) {
        if (isAuthError?.(err)) {
          onAuthError?.({ error: err });
          throw err;
        }

        const message =
          err?.payload?.error?.message ||
          (err instanceof Error ? err.message : 'Não foi possível reatribuir a campanha');
        setCampaignError(message);
        notifyError('Falha ao reatribuir campanha', { description: message });
        logError?.('Falha ao reatribuir campanha WhatsApp', err);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setCampaignAction(null);
      }
    },
    [agreementId, instanceId, isAuthError, loadCampaigns, logError, notifyError, notifySuccess, onAuthError]
  );

  const fetchCampaignImpact = useCallback(
    async (campaignId) => {
      if (!campaignId) {
        return { summary: null };
      }

      try {
        const response = await apiGet(
          `/api/lead-engine/allocations?campaignId=${encodeURIComponent(campaignId)}`
        );
        const summary = response?.meta?.summary ?? null;
        return { summary, items: Array.isArray(response?.data) ? response.data : [] };
      } catch (err) {
        if (isAuthError?.(err)) {
          onAuthError?.({ error: err });
        }
        throw err instanceof Error ? err : new Error('Falha ao carregar impacto da campanha');
      }
    },
    [isAuthError, onAuthError]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchInitial = async () => {
      const result = await loadCampaigns({
        preferredAgreementId: agreementId,
        preferredInstanceId: instanceId ?? null,
      });
      if (!cancelled && result?.error && !isAuthError?.(result.error)) {
        warn?.('Falha ao listar campanhas', result.error);
      }
    };

    void fetchInitial();

    return () => {
      cancelled = true;
    };
  }, [agreementId, instanceId, isAuthError, loadCampaigns, warn]);

  return {
    campaign,
    campaigns,
    campaignsLoading,
    campaignError,
    campaignAction,
    persistentWarning,
    loadCampaigns,
    createCampaign,
    updateCampaignStatus,
    deleteCampaign,
    reassignCampaign,
    fetchCampaignImpact,
    clearCampaignSelection,
    setCampaignError,
  };
};

export default useWhatsAppCampaigns;
