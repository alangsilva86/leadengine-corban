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
    <header className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground/70">
        {stepLabel ? (
          <Badge
            variant="outline"
            className="border-border/60 bg-transparent px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground/80"
          >
            {stepLabel}
          </Badge>
        ) : null}
        <span className="text-muted-foreground/70">Fluxo concluído</span>
      </div>

      <Breadcrumb className="text-[11px] font-medium text-muted-foreground/70">
        <BreadcrumbList>
          {breadcrumbItems.map((item, index) => (
            <BreadcrumbItem key={item.label}>
              {item.current ? (
                <BreadcrumbPage className="flex items-center gap-1.5 text-sm font-semibold text-foreground/85">
                  {item.icon ? <item.icon className="h-3.5 w-3.5 text-muted-foreground/65" aria-hidden /> : null}
                  <span>{item.label}</span>
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  href={item.href}
                  className="text-[11px] font-medium text-muted-foreground/70 hover:text-foreground/80"
                >
                  {item.label}
                </BreadcrumbLink>
              )}
              {index < breadcrumbItems.length - 1 ? <BreadcrumbSeparator /> : null}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-base font-bold text-foreground">Inbox de Leads</h1>
          <p className="text-sm font-semibold text-muted-foreground/80">
            Organize e priorize as conversas do seu time em um só lugar.
          </p>
          <p className="max-w-xl text-[13px] text-muted-foreground/80">
            Respostas rápidas mantêm a confiança do lead. Acompanhe métricas e prossiga para {nextStage.toLowerCase()} quando estiver tudo pronto.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground/70">Status atual</p>
          <p className="text-base font-semibold text-emerald-300">
            {hasLeadCount ? `${leadCount} leads ativos` : 'Monitorando leads'}
          </p>
          <p className="text-[13px] text-muted-foreground/80">Próximo passo: {nextStage}</p>
        </div>
      </div>

      {campaignName ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground/80">
          <span className="text-sm font-semibold text-muted-foreground/90">Campanha ativa</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-muted-foreground/80">
            {campaignName}
          </span>
        </div>
      ) : null}
    </header>
  );
};

export default InboxHeader;
