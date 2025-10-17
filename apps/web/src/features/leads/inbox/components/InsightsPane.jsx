import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { InboxSurface } from './shared/InboxSurface.jsx';
import InboxSummaryGrid, { statusMetrics, formatSummaryValue } from './InboxSummaryGrid.jsx';
import LeadProfilePanel from './LeadProfilePanel.jsx';
import ManualConversationCard from './ManualConversationCard.jsx';
import InboxActions from './InboxActions.jsx';

const InsightsPane = ({
  summary,
  activeAllocation,
  onUpdateAllocationStatus,
  onOpenWhatsApp,
  leadPanelSwitching,
  manualConversationCardRef,
  manualConversationPending,
  onManualConversationSubmit,
  onManualConversationSuccess,
  rateLimitInfo,
  autoRefreshSeconds,
  lastUpdatedAt,
  loading,
  onRefresh,
  onExport,
  onStartManualConversation,
}) => {
  return (
    <div className="flex-1 min-h-0">
      <div
        className="h-full overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
        style={{ WebkitOverflowScrolling: 'touch', contain: 'content' }}
      >
        <div className="space-y-5 px-5 pb-6 pt-5">
          <InboxSurface as={Card}>
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
                  <InboxSurface
                    as="div"
                    radius="md"
                    shadow="none"
                    key={key}
                    className="space-y-1 px-3 py-3 text-[color:var(--color-inbox-foreground-muted)] shadow-[0_14px_30px_color-mix(in_srgb,var(--color-inbox-border)_48%,transparent)]"
                  >
                    <dt className="flex items-center gap-2 text-xs font-medium text-[color:var(--color-inbox-foreground-muted)]">
                      {icon ? icon : null}
                      <span>{label}</span>
                    </dt>
                    <dd className={`text-xl font-semibold text-[color:var(--color-inbox-foreground)] ${accent ?? ''}`}>
                      {formatSummaryValue(summary[key])}
                    </dd>
                  </InboxSurface>
                ))}
              </dl>
            </CardContent>
          </InboxSurface>

          <InboxSummaryGrid summary={summary} />

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
            onRefresh={onRefresh}
            onExport={onExport}
            onStartManualConversation={onStartManualConversation}
            rateLimitInfo={rateLimitInfo}
            autoRefreshSeconds={autoRefreshSeconds}
            lastUpdatedAt={lastUpdatedAt}
          />
        </div>
      </div>
    </div>
  );
};

export default InsightsPane;
