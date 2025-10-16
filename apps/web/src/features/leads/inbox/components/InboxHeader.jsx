import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { MessageSquare } from 'lucide-react';

export const InboxHeader = ({ stepLabel, campaign, onboarding }) => {
  const activeStep = onboarding?.activeStep ?? 0;
  const nextStage = onboarding?.stages?.[activeStep + 1]?.title ?? 'Relatórios';
  const leadCount = onboarding?.metrics?.inboxCount ?? null;
  const campaignName = campaign?.name;
  const hasLeadCount = typeof leadCount === 'number';

  const breadcrumbItems = [
    { label: 'Leads', href: '#leads' },
    { label: 'Inbox', current: true, icon: MessageSquare },
  ];

  return (
    <header className="glass-surface rounded-[32px] border border-[var(--border)] p-6 shadow-[0_20px_46px_color-mix(in_srgb,var(--border)_42%,transparent)] ring-1 ring-[color:var(--surface-overlay-glass-border)]">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
        {stepLabel ? (
          <Badge
            variant="outline"
            className="border-[color:var(--surface-overlay-glass-border)] bg-[color:var(--surface-overlay-quiet)] px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-foreground"
          >
            {stepLabel}
          </Badge>
        ) : null}
        <span className="text-muted-foreground">Fluxo concluído</span>
      </div>

      <Breadcrumb className="mt-5 text-xs font-medium text-muted-foreground">
        <BreadcrumbList>
          {breadcrumbItems.map((item, index) => (
            <BreadcrumbItem key={item.label}>
              {item.current ? (
                <BreadcrumbPage className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {item.icon ? <item.icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : null}
                  <span>{item.label}</span>
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  href={item.href}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </BreadcrumbLink>
              )}
              {index < breadcrumbItems.length - 1 ? <BreadcrumbSeparator /> : null}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Inbox de Leads</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Organize e priorize as conversas do seu time em um só lugar.
          </p>
          <p className="max-w-xl text-[13px] text-muted-foreground">
            Respostas rápidas mantêm a confiança do lead. Acompanhe métricas e prossiga para {nextStage.toLowerCase()} quando estiver tudo pronto.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 rounded-2xl border border-[var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_82%,transparent)] px-5 py-4 text-right text-muted-foreground shadow-[0_12px_32px_color-mix(in_srgb,var(--border)_38%,transparent)]">
          <p className="text-xs font-medium uppercase tracking-[0.24em]">Status atual</p>
          <p className="text-base font-semibold text-foreground">
            {hasLeadCount ? (
              <>
                <span className="text-[color:var(--primary)]">{leadCount}</span> leads ativos
              </>
            ) : (
              'Monitorando leads'
            )}
          </p>
          <p className="text-[13px]">Próximo passo: {nextStage}</p>
        </div>
      </div>

      {campaignName ? (
        <div className="mt-6 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <span className="text-sm font-semibold text-foreground">Campanha ativa</span>
          <span className="rounded-full border border-[var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_82%,transparent)] px-3 py-1 text-xs font-medium text-muted-foreground">
            {campaignName}
          </span>
        </div>
      ) : null}
    </header>
  );
};

export default InboxHeader;
