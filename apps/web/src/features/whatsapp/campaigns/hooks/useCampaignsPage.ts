import { useCallback, useMemo, useReducer } from 'react';

import useWhatsAppNumbers from '../../hooks/useWhatsAppNumbers';
import useWhatsappCampaignActions from '../../connect/hooks/useWhatsappCampaignActions';
import { campaignReducer, initialCampaignState } from '../campaignState';

/** Falhas já aparecem para o usuário (toast/erro na tela); aqui fica só o detalhe técnico. */
const logError = (message: string, error: unknown) => {
  console.error(`[regras de roteamento] ${message}`, error);
};

/**
 * Dados da tela de regras: lista de números (só leitura, sem QR) + regras da empresa.
 * Substitui o uso do assistente de conexão inteiro nesta tela.
 */
const useCampaignsPage = () => {
  const numbers = useWhatsAppNumbers();
  const [state, dispatch] = useReducer(campaignReducer, initialCampaignState);

  const handleAuthFallback = useCallback(
    (options: { error: any }) => numbers.wa.handleAuthFallback(options),
    [numbers.wa.handleAuthFallback],
  );

  const actions = useWhatsappCampaignActions({
    state,
    dispatch,
    selectedAgreement: null,
    activeCampaign: null,
    instance: null,
    instances: numbers.instances,
    handleAuthFallback,
    logError,
  });

  const numbersById = useMemo(() => {
    const map = new Map<string, (typeof numbers.numbers)[number]>();
    numbers.numbers.forEach((number) => map.set(number.id, number));
    return map;
  }, [numbers.numbers]);

  const counts = useMemo(() => {
    const totals = { active: 0, paused: 0, draft: 0, withoutNumber: 0 };
    actions.campaigns.forEach((campaign: any) => {
      if (campaign?.status === 'active') totals.active += 1;
      else if (campaign?.status === 'paused') totals.paused += 1;
      else if (campaign?.status === 'draft') totals.draft += 1;
      if (!campaign?.instanceId) totals.withoutNumber += 1;
    });
    return totals;
  }, [actions.campaigns]);

  return {
    ...actions,
    numbers,
    numbersById,
    counts,
    /** Regras exigem ao menos um número conectado na empresa (não precisa ser o "selecionado"). */
    canCreateCampaigns: numbers.hasConnectedNumber,
  };
};

export default useCampaignsPage;
