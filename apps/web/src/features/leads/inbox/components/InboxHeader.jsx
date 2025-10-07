import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';

export const InboxHeader = ({
  stepLabel,
  selectedAgreement,
  campaign,
  onboarding,
  leadCount = 0,
}) => {
  const agreementName = selectedAgreement?.name;
  const activeStep = onboarding?.activeStep ?? 0;
  const nextStage = onboarding?.stages?.[activeStep + 1]?.title ?? 'Relatórios';
  const campaignName = campaign?.name;

  const breadcrumbItems = [
    { label: 'Leads', href: '#leads' },
    { label: 'Inbox', current: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.24em] text-muted-foreground/70">
        <Badge
          variant="outline"
          className="border-border/60 bg-transparent px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground"
        >
          {stepLabel}
        </Badge>
        <span className="text-[11px] font-medium text-muted-foreground/80">Fluxo concluído</span>
      </div>

      <div className="flex flex-col gap-3">
        <Breadcrumb className="text-xs text-muted-foreground/70">
          <BreadcrumbList>
            {breadcrumbItems.map((item, index) => (
              <BreadcrumbItem key={item.label}>
                {item.current ? (
                  <BreadcrumbPage className="text-sm font-medium text-foreground/90">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={item.href}
                    className="text-xs font-medium text-muted-foreground/80 hover:text-foreground/80"
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
                {index < breadcrumbItems.length - 1 ? <BreadcrumbSeparator /> : null}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-[1.625rem] font-semibold leading-tight tracking-tight text-foreground">
              Inbox de Leads
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Leads do convênio {agreementName ?? 'selecionado'} sincronizados automaticamente após cada mensagem no WhatsApp
              conectado.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground/80">
            <p className="font-medium text-foreground/80">{leadCount} leads ativos</p>
            <p>Próximo passo: {nextStage}</p>
          </div>
        </div>
      </div>

      {campaignName ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/80">
          <span className="font-medium text-foreground/80">Campanha ativa</span>
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn('rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-foreground/90')}>
              {campaignName}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InboxHeader;
