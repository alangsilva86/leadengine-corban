import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Trophy, XCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';

import { useLeadAllocations } from '../hooks/useLeadAllocations.js';
import useInboxLiveUpdates from '@/features/whatsapp-inbound/sockets/useInboxLiveUpdates.js';
import InboxHeader from './InboxHeader.jsx';
import InboxActions from './InboxActions.jsx';
import InboxList from './InboxList.jsx';
import StatusFilter from './StatusFilter.jsx';

const statusMetrics = [
  { key: 'total', label: 'Total recebido' },
  { key: 'contacted', label: 'Em conversa' },
  { key: 'won', label: 'Ganhos', accent: 'text-emerald-600', icon: <Trophy className="h-4 w-4" /> },
  { key: 'lost', label: 'Perdidos', accent: 'text-destructive', icon: <XCircle className="h-4 w-4" /> },
];

const formatSummaryValue = (value) => value ?? 0;

export const LeadInbox = ({
  selectedAgreement,
  campaign,
  onboarding,
  onSelectAgreement,
  onBackToWhatsApp,
}) => {
  const agreementId = selectedAgreement?.id;
  const campaignId = campaign?.id;

  const [statusFilter, setStatusFilter] = useState('all');
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(null);

  const {
    allocations,
    summary,
    loading,
    error,
    warningMessage,
    rateLimitInfo,
    refresh,
    updateAllocationStatus,
    lastUpdatedAt,
    nextRefreshAt,
  } = useLeadAllocations({ agreementId, campaignId, instanceId: campaign?.instanceId });

  const { connected: realtimeConnected, connectionError } = useInboxLiveUpdates({
    tenantId: selectedAgreement?.tenantId ?? campaign?.tenantId ?? null,
    enabled: Boolean(agreementId || campaignId),
    onLead: () => {
      refresh();
    },
  });

  const stageIndex = onboarding?.stages?.findIndex((stage) => stage.id === 'inbox') ?? onboarding?.activeStep ?? 3;
  const totalStages = onboarding?.stages?.length ?? 0;
  const stepNumber = stageIndex >= 0 ? stageIndex + 1 : 4;
  const stepLabel = totalStages ? `Passo ${Math.min(stepNumber, totalStages)} de ${totalStages}` : `Passo ${stepNumber}`;

  useEffect(() => {
    setStatusFilter('all');
  }, [agreementId, campaignId]);

  useEffect(() => {
    if (!nextRefreshAt) {
      setAutoRefreshSeconds(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
      setAutoRefreshSeconds(remaining);
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [nextRefreshAt]);

  const filteredAllocations = useMemo(() => {
    if (statusFilter === 'all') {
      return allocations;
    }
    return allocations.filter((allocation) => allocation.status === statusFilter);
  }, [allocations, statusFilter]);

  const openWhatsApp = (allocation) => {
    const phone = allocation.phone?.replace(/\D/g, '');
    if (!phone) return;
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <InboxHeader
        stepLabel={stepLabel}
        selectedAgreement={selectedAgreement}
        campaign={campaign}
        onboarding={onboarding}
      />

      <Card>
        <CardHeader className="flex flex-wrap items-center gap-4">
          <div>
            <CardTitle>Resumo</CardTitle>
            <CardDescription>Distribuição dos leads que já chegaram ao seu WhatsApp.</CardDescription>
          </div>
          <div className="ml-auto flex items-center gap-6 text-sm">
            {statusMetrics.map(({ key, label, accent, icon }) => (
              <div key={key} className="flex flex-col items-start gap-1">
                <p className="flex items-center gap-1 text-muted-foreground">
                  {icon ? icon : null}
                  {label}
                </p>
                <p className={`text-lg font-semibold ${accent ?? ''}`}>{formatSummaryValue(summary[key])}</p>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
         <InboxActions
            loading={loading}
            onRefresh={refresh}
            onExport={() => {
              const params = new URLSearchParams();
              if (campaignId) params.set('campaignId', campaignId);
              if (agreementId) params.set('agreementId', agreementId);
              if (statusFilter !== 'all') {
                params.set('status', statusFilter);
              }
              if (campaign?.instanceId) {
                params.set('instanceId', campaign.instanceId);
              }
              window.open(`/api/lead-engine/allocations/export?${params.toString()}`, '_blank');
            }}
            rateLimitInfo={rateLimitInfo}
            autoRefreshSeconds={autoRefreshSeconds}
            lastUpdatedAt={lastUpdatedAt}
          />

          {!realtimeConnected && !connectionError ? (
            <NoticeBanner variant="info">
              Conectando ao tempo real para receber novos leads automaticamente…
            </NoticeBanner>
          ) : null}

          {connectionError ? (
            <NoticeBanner variant="warning" icon={<AlertCircle className="h-4 w-4" />}>
              Tempo real indisponível: {connectionError}. Continuamos monitorando via atualização automática.
            </NoticeBanner>
          ) : null}

          <div className="flex items-center justify-between">
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
          </div>

          {error ? (
            <NoticeBanner variant="danger" icon={<AlertCircle className="h-4 w-4" />}>
              {error}
            </NoticeBanner>
          ) : null}

          {!error && warningMessage ? (
            <NoticeBanner variant="warning" icon={<AlertCircle className="h-4 w-4" />}>
              {warningMessage}
            </NoticeBanner>
          ) : null}

          <InboxList
            allocations={allocations}
            filteredAllocations={filteredAllocations}
            loading={loading}
            selectedAgreement={selectedAgreement}
            campaign={campaign}
            onOpenWhatsApp={openWhatsApp}
            onUpdateStatus={updateAllocationStatus}
            onBackToWhatsApp={onBackToWhatsApp}
            onSelectAgreement={onSelectAgreement}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadInbox;
