import { AlertCircle, MessageSquare, Trophy, XCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { GlassPanel } from '@/components/ui/glass-panel.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { cn } from '@/lib/utils.js';

import InboxHeader from '../InboxHeader.jsx';
import GlobalFiltersBar from '../GlobalFiltersBar.jsx';
import InboxList from '../InboxList.jsx';
import LeadConversationPanel from '../LeadConversationPanel.jsx';
import LeadProfilePanel from '../LeadProfilePanel.jsx';
import ManualConversationCard from '../ManualConversationCard.jsx';
import InboxActions from '../InboxActions.jsx';
import { SAVED_VIEWS_LIMIT, TIME_WINDOW_OPTIONS } from '../../utils/filtering.js';

const InboxPageContainer = ({ children, className }) => (
  <div className={cn('flex min-h-[100dvh] w-full flex-col', className)}>
    {children}
  </div>
);

const statusMetrics = [
  { key: 'total', label: 'Total recebido' },
  {
    key: 'contacted',
    label: 'Em conversa',
    accent: 'text-status-whatsapp',
    icon: <MessageSquare className="h-4 w-4 text-status-whatsapp" />,
  },
  {
    key: 'won',
    label: 'Ganhos',
    accent: 'text-success',
    icon: <Trophy className="h-4 w-4 text-success" />,
  },
  {
    key: 'lost',
    label: 'Perdidos',
    accent: 'text-status-error',
    icon: <XCircle className="h-4 w-4 text-status-error" />,
  },
];

const formatSummaryValue = (value) => value ?? 0;

const LeadInboxView = ({
  campaign,
  onboarding,
  stepLabel,
  filters,
  onUpdateFilters,
  onResetFilters,
  queueOptions,
  savedViews,
  activeViewId,
  onSelectSavedView,
  onSaveCurrentView,
  onDeleteSavedView,
  canSaveView,
  allocations,
  filteredAllocations,
  loading,
  selectedAgreement,
  onSelectAgreement,
  onBackToWhatsApp,
  onSelectAllocation,
  activeAllocationId,
  onOpenWhatsApp,
  inboxListRef,
  registerInboxScrollViewport,
  scrollParent,
  hasNotices,
  showRealtimeConnecting,
  showRealtimeError,
  connectionError,
  error,
  warningMessage,
  activeAllocation,
  leadPanelSwitching,
  onUpdateAllocationStatus,
  onManualConversationSubmit,
  onManualConversationSuccess,
  manualConversationPending,
  manualConversationCardRef,
  onOpenManualConversationCard,
  summary,
  autoRefreshSeconds,
  lastUpdatedAt,
  refresh,
  rateLimitInfo,
  onExport,
}) => {
  return (
    <InboxPageContainer className="gap-6 xl:gap-8">
      <InboxHeader stepLabel={stepLabel} campaign={campaign} onboarding={onboarding} />

      <div className="min-h-0 flex-1 xl:overflow-hidden">
        <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[minmax(320px,340px)_minmax(0,1fr)_minmax(320px,340px)] xl:gap-7">
          <GlassPanel
            as="section"
            tone="inbox"
            radius="xl"
            shadow="2xl"
            className="relative flex min-w-0 flex-col overflow-hidden xl:h-full xl:min-h-0"
          >
            <div className="flex-shrink-0 border-b border-[color:var(--color-inbox-border)] px-5 py-5">
              <GlobalFiltersBar
                filters={filters}
                onUpdateFilters={onUpdateFilters}
                onResetFilters={onResetFilters}
                queueOptions={queueOptions}
                windowOptions={TIME_WINDOW_OPTIONS}
                savedViews={savedViews}
                activeViewId={activeViewId}
                onSelectSavedView={onSelectSavedView}
                onSaveCurrentView={onSaveCurrentView}
                onDeleteSavedView={onDeleteSavedView}
                canSaveView={canSaveView}
                viewLimit={SAVED_VIEWS_LIMIT}
              />
            </div>

            <ScrollArea
              className="flex-1 min-h-0"
              viewportRef={registerInboxScrollViewport}
              viewportClassName="h-full space-y-5 px-5 pb-6 pr-6 pt-5 overscroll-contain scroll-smooth"
              viewportProps={{
                style: { WebkitOverflowScrolling: 'touch', contain: 'content' },
              }}
            >
              <InboxList
                allocations={allocations}
                filteredAllocations={filteredAllocations}
                loading={loading}
                selectedAgreement={selectedAgreement}
                campaign={campaign}
                onBackToWhatsApp={onBackToWhatsApp}
                onSelectAgreement={onSelectAgreement}
                onSelectAllocation={onSelectAllocation}
                activeAllocationId={activeAllocationId}
                onOpenWhatsApp={onOpenWhatsApp}
                className="pb-3"
                ref={inboxListRef}
                scrollParent={scrollParent}
              />

              {hasNotices ? (
                <div className="space-y-3 text-sm">
                  {showRealtimeConnecting ? (
                    <NoticeBanner tone="info" className="rounded-2xl">
                      Conectando ao tempo real para receber novos leads automaticamente…
                    </NoticeBanner>
                  ) : null}

                  {showRealtimeError ? (
                    <NoticeBanner
                      tone="warning"
                      icon={<AlertCircle className="h-4 w-4" />}
                      className="rounded-2xl"
                    >
                      Tempo real indisponível: {connectionError}. Continuamos monitorando via atualização automática.
                    </NoticeBanner>
                  ) : null}

                  {error ? (
                    <NoticeBanner
                      tone="error"
                      icon={<AlertCircle className="h-4 w-4" />}
                      className="rounded-2xl"
                    >
                      {error}
                    </NoticeBanner>
                  ) : null}

                  {!error && warningMessage ? (
                    <NoticeBanner
                      tone="warning"
                      icon={<AlertCircle className="h-4 w-4" />}
                      className="rounded-2xl"
                    >
                      {warningMessage}
                    </NoticeBanner>
                  ) : null}
                </div>
              ) : null}
            </ScrollArea>

            <div className="pointer-events-none absolute inset-y-6 -right-4 hidden xl:block">
              <span className="block h-full w-px rounded-full bg-[color:var(--color-inbox-border)] shadow-[1px_0_18px_color-mix(in_srgb,var(--color-inbox-border)_55%,transparent)]" />
            </div>
          </GlassPanel>

          <div className="relative flex min-w-0 flex-col overflow-hidden xl:h-full xl:min-h-0">
            <LeadConversationPanel
              allocation={activeAllocation}
              onOpenWhatsApp={onOpenWhatsApp}
              isLoading={loading}
              isSwitching={leadPanelSwitching}
            />

            <div className="pointer-events-none absolute inset-y-6 -right-4 hidden xl:block">
              <span className="block h-full w-px rounded-full bg-[color:var(--color-inbox-border)] shadow-[1px_0_20px_color-mix(in_srgb,var(--color-inbox-border)_60%,transparent)]" />
            </div>
          </div>

          <GlassPanel
            as="aside"
            tone="inbox"
            radius="xl"
            shadow="xl"
            className="flex min-w-0 flex-col overflow-hidden xl:h-full xl:min-h-0"
          >
            <ScrollArea
              className="flex-1 min-h-0"
              viewportClassName="h-full space-y-5 px-5 pb-6 pt-5 overscroll-contain"
              viewportProps={{
                style: { WebkitOverflowScrolling: 'touch', contain: 'content' },
              }}
            >
              <Card className="rounded-3xl border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-xl)]">
                <CardHeader className="space-y-2 pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-inbox-foreground)]">
                    Resumo
                  </CardTitle>
                  <CardDescription className="text-xs text-[color:var(--color-inbox-foreground-muted)]">
                    Distribuição dos leads recebidos via WhatsApp conectado.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4">
                    {statusMetrics.map(({ key, label, accent, icon }) => (
                      <div
                        key={key}
                        className="space-y-1 rounded-2xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] px-3 py-3 text-[color:var(--color-inbox-foreground-muted)] shadow-[0_14px_30px_color-mix(in_srgb,var(--color-inbox-border)_48%,transparent)]"
                      >
                        <dt className="flex items-center gap-2 text-xs font-medium text-[color:var(--color-inbox-foreground-muted)]">
                          {icon ? icon : null}
                          <span>{label}</span>
                        </dt>
                        <dd className={cn('text-xl font-semibold text-[color:var(--color-inbox-foreground)]', accent ?? '')}>
                          {formatSummaryValue(summary[key])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>

              <LeadProfilePanel
                allocation={activeAllocation}
                onUpdateStatus={onUpdateAllocationStatus}
                onOpenWhatsApp={onOpenWhatsApp}
                isLoading={loading}
                isSwitching={leadPanelSwitching}
              />

              <ManualConversationCard
                ref={manualConversationCardRef}
                onSubmit={onManualConversationSubmit}
                onSuccess={onManualConversationSuccess}
                isSubmitting={manualConversationPending}
              />

              <InboxActions
                loading={loading}
                onRefresh={refresh}
                onExport={onExport}
                onStartManualConversation={onOpenManualConversationCard}
                rateLimitInfo={rateLimitInfo}
                autoRefreshSeconds={autoRefreshSeconds}
                lastUpdatedAt={lastUpdatedAt}
              />
            </ScrollArea>
          </GlassPanel>
        </div>
      </div>
    </InboxPageContainer>
  );
};

export default LeadInboxView;
