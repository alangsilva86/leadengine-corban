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
    <header className="rounded-[32px] border border-white/12 bg-[#0b172b] p-6 shadow-[0_20px_46px_rgba(3,8,22,0.5)] ring-1 ring-white/10">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-white/70">
        {stepLabel ? (
          <Badge
            variant="outline"
            className="border-white/40 bg-white/[0.08] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-white/80"
          >
            {stepLabel}
          </Badge>
        ) : null}
        <span className="text-white/70">Fluxo concluído</span>
      </div>

      <Breadcrumb className="mt-5 text-[11px] font-medium text-white/70">
        <BreadcrumbList>
          {breadcrumbItems.map((item, index) => (
            <BreadcrumbItem key={item.label}>
              {item.current ? (
                <BreadcrumbPage className="flex items-center gap-1.5 text-sm font-semibold text-white/85">
                  {item.icon ? <item.icon className="h-3.5 w-3.5 text-white/65" aria-hidden /> : null}
                  <span>{item.label}</span>
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  href={item.href}
                  className="text-[11px] font-medium text-white/70 hover:text-white/90"
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
          <h1 className="text-xl font-semibold text-white/95">Inbox de Leads</h1>
          <p className="text-sm font-semibold text-white/75">
            Organize e priorize as conversas do seu time em um só lugar.
          </p>
          <p className="max-w-xl text-[13px] text-white/70">
            Respostas rápidas mantêm a confiança do lead. Acompanhe métricas e prossiga para {nextStage.toLowerCase()} quando estiver tudo pronto.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 rounded-2xl border border-white/15 bg-white/[0.08] px-5 py-4 text-right shadow-[0_12px_32px_rgba(3,9,24,0.4)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/70">Status atual</p>
          <p className="text-base font-semibold text-emerald-300">
            {hasLeadCount ? `${leadCount} leads ativos` : 'Monitorando leads'}
          </p>
          <p className="text-[13px] text-white/70">Próximo passo: {nextStage}</p>
        </div>
      </div>

      {campaignName ? (
        <div className="mt-6 flex flex-wrap items-center gap-2 text-[13px] text-white/75">
          <span className="text-sm font-semibold text-white/80">Campanha ativa</span>
          <span className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[11px] font-medium text-white/70">
            {campaignName}
          </span>
        </div>
      ) : null}
    </header>
  );
};

export default InboxHeader;
