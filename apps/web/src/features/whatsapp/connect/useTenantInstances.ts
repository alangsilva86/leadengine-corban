import { useCallback, useEffect, useMemo } from 'react';

import useWhatsAppInstances from '../hooks/useWhatsAppInstances.jsx';
import { shouldDisplayInstance } from '../lib/instances';
import { sortInstancesByLabel } from './utils/instances';
import type { WhatsAppConnectAction, WhatsAppConnectState } from './useWhatsAppConnect';
import { persistShowAllPreference, readShowAllPreference } from './utils/preferences';
import { resolveAgreementTenantId, resolveInstanceTenantId, resolveTenantDisplayName } from './utils/tenant';

interface UseTenantInstancesParams {
  selectedAgreement: any;
  status?: string;
  activeCampaign?: any;
  onStatusChange?: (status: string) => void;
  onError: (message: string | null, meta?: any) => void;
  logger: { log: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void };
  dispatch: (action: WhatsAppConnectAction) => void;
  state: WhatsAppConnectState;
  campaignInstanceId: string | null;
}

const useTenantInstances = ({
  selectedAgreement,
  status,
  activeCampaign,
  onStatusChange,
  onError,
  logger,
  dispatch,
  state,
  campaignInstanceId,
}: UseTenantInstancesParams) => {
  const {
    instances,
    instancesReady,
    currentInstance: instance,
    status: rawStatus,
    qrData,
    secondsLeft,
    loadingInstances,
    loadingQr,
    isAuthenticated,
    deletingInstanceId,
    liveEvents,
    loadInstances,
    selectInstance,
    generateQr,
    connectInstance,
    createInstance,
    deleteInstance,
    markConnected,
    handleAuthFallback,
    setSecondsLeft,
    setGeneratingQrState,
    setStatus,
    realtimeConnected,
    selectedInstanceStatus,
  } = useWhatsAppInstances({
    selectedAgreement,
    status,
    onStatusChange,
    onError,
    logger,
    campaignInstanceId,
  });

  const localStatus = (selectedInstanceStatus || rawStatus || 'disconnected').toLowerCase();
  const hasTenantScope = Boolean(selectedAgreement?.tenantId);
  const createInstanceWarning = hasTenantScope
    ? null
    : 'Selecione um acordo com tenantId válido para criar um novo canal do WhatsApp.';
  const canCreateInstance = hasTenantScope;
  const tenantFilterId = useMemo(
    () => resolveAgreementTenantId(selectedAgreement),
    [selectedAgreement]
  );
  const tenantFilterLabel = useMemo(
    () => resolveTenantDisplayName(selectedAgreement),
    [selectedAgreement]
  );
  const tenantScopedInstances = useMemo(() => {
    if (!tenantFilterId) {
      return instances;
    }
    return instances.filter((entry) => resolveInstanceTenantId(entry) === tenantFilterId);
  }, [instances, tenantFilterId]);
  const tenantFilteredOutCount = tenantFilterId
    ? instances.length - tenantScopedInstances.length
    : 0;
  const selectedInstanceBelongsToTenant = useMemo(() => {
    if (!tenantFilterId || !instance) {
      return true;
    }
    return resolveInstanceTenantId(instance) === tenantFilterId;
  }, [instance, tenantFilterId]);

  useEffect(() => {
    persistShowAllPreference(state.showAllInstances);
  }, [state.showAllInstances]);

  useEffect(() => {
    if (!tenantFilterId || !instance || selectedInstanceBelongsToTenant) {
      return;
    }
    void selectInstance(null, { skipAutoQr: true });
  }, [instance, selectInstance, selectedInstanceBelongsToTenant, tenantFilterId]);

  const setShowAllInstances = useCallback((value: boolean) => {
    dispatch({ type: 'set-show-all-instances', value });
  }, [dispatch]);

  const visibleInstances = useMemo(
    () => tenantScopedInstances.filter(shouldDisplayInstance),
    [tenantScopedInstances]
  );
  const totalInstanceCount = tenantScopedInstances.length;
  const visibleInstanceCount = visibleInstances.length;
  const hasHiddenInstances = totalInstanceCount > visibleInstanceCount;
  const filteredInstances = state.showAllInstances ? tenantScopedInstances : visibleInstances;
  const renderInstances = useMemo(
    () => sortInstancesByLabel(filteredInstances),
    [filteredInstances],
  );
  const tenantScopeNotice =
    tenantFilterId && tenantFilteredOutCount > 0
      ? `${tenantFilteredOutCount} instância(s) ocultadas por pertencerem a tenants diferentes de ${
          tenantFilterLabel ?? tenantFilterId
        }.`
      : null;

  const nextInstanceOrdinal = tenantScopedInstances.length + 1;

  const initialShowAll = readShowAllPreference();
  useEffect(() => {
    if (state.showAllInstances !== initialShowAll) {
      dispatch({ type: 'set-show-all-instances', value: initialShowAll });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    instance,
    instances,
    renderInstances,
    instancesReady,
    hasHiddenInstances,
    visibleInstanceCount,
    totalInstanceCount,
    tenantScopeNotice,
    tenantFilterId,
    tenantFilterLabel,
    tenantFilteredOutCount,
    selectedInstanceBelongsToTenant,
    tenantScopedInstances,
    localStatus,
    qrData,
    secondsLeft,
    loadingInstances,
    loadingQr,
    isAuthenticated,
    deletingInstanceId,
    liveEvents,
    loadInstances,
    selectInstance,
    generateQr,
    connectInstance,
    createInstance,
    deleteInstance,
    markConnected,
    handleAuthFallback,
    setSecondsLeft,
    setGeneratingQrState,
    setInstanceStatus: setStatus,
    realtimeConnected,
    selectedInstanceStatus,
    showAllInstances: state.showAllInstances,
    setShowAllInstances,
    createInstanceWarning,
    canCreateInstance,
    nextInstanceOrdinal,
  };
};

export default useTenantInstances;
