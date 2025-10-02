import { Badge } from '@/components/ui/badge.jsx';

export const InboxHeader = ({
  stepLabel,
  selectedAgreement,
  campaign,
  onboarding,
}) => {
  const agreementName = selectedAgreement?.name;
  const activeStep = onboarding?.activeStep ?? 0;
  const nextStage = onboarding?.stages?.[activeStep + 1]?.title ?? 'Relatórios';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-300/80">
        <Badge variant="secondary">{stepLabel}</Badge>
        <span>Fluxo concluído</span>
      </div>
      <h1 className="text-2xl font-semibold text-foreground">Inbox de leads</h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Leads do convênio {agreementName}. Assim que o cliente fala com você no WhatsApp conectado, o contato aparece aqui automaticamente.
      </p>
      {campaign?.name ? (
        <p className="text-xs text-muted-foreground">
          Campanha ativa: <span className="font-medium text-foreground">{campaign.name}</span>
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">Próximo passo: {nextStage}</p>
    </div>
  );
};

export default InboxHeader;
