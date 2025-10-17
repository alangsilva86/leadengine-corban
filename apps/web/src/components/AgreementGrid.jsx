import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { AgreementCard, AgreementCardSkeleton } from './agreements/index.js';
import useAgreements from '@/features/agreements/useAgreements.js';
import useOnboardingStepLabel from '@/features/onboarding/useOnboardingStepLabel.js';

const AgreementGrid = ({ onboarding, selectedAgreement, onSelect }) => {
  const { agreements, isLoading, error, retry } = useAgreements();
  const { stepLabel, nextStage } = useOnboardingStepLabel({
    stages: onboarding?.stages,
    targetStageId: 'agreements',
    fallbackStep: { number: 2, label: 'Passo 2', nextStage: 'WhatsApp' },
  });

  const showSkeletons = isLoading && agreements.length === 0;

  return (
    <div className="space-y-6">
      <header className="glass-surface flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] px-6 py-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Escolha seu convênio</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Veja o tamanho da oportunidade, selecione o convênio ideal e reserve os leads que já responderam à nossa
            inteligência omnicanal.
          </p>
        </div>
        {selectedAgreement ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-medium text-primary">
              Convênio ativo
            </span>
            <strong className="text-foreground">{selectedAgreement.name}</strong>
            <Button size="sm" onClick={() => onSelect?.(selectedAgreement)}>
              Seguir para WhatsApp
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="secondary">{stepLabel}</Badge>
            {nextStage ? <span>Próximo: {nextStage}</span> : null}
          </div>
        )}
      </header>

      {error ? (
        <div className="flex flex-wrap items-start gap-3 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div className="space-y-1">
            <p className="font-medium">Não foi possível carregar os convênios.</p>
            <p className="text-xs text-destructive/80">{error}</p>
          </div>
          <Button size="sm" variant="outline" className="ml-auto" onClick={retry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {showSkeletons
          ? Array.from({ length: 3 }).map((_, index) => <AgreementCardSkeleton key={`skeleton-${index}`} />)
          : agreements.map((agreement, index) => (
              <AgreementCard
                key={agreement.id ?? `${agreement.name ?? 'agreement'}-${index}`}
                name={agreement.name}
                description={agreement.description}
                region={agreement.region}
                availableLeads={agreement.availableLeads}
                hotLeads={agreement.hotLeads}
                tags={agreement.tags ?? []}
                lastSyncAt={agreement.lastSyncAt}
                isSelected={selectedAgreement?.id === agreement.id}
                onSelect={() => onSelect?.(agreement)}
              />
            ))}
      </div>

      {!isLoading && !error && agreements.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)]/70 p-6 text-center text-sm text-muted-foreground">
          Nenhum convênio disponível no momento. Volte mais tarde ou fale com o suporte para liberar novos acordos.
        </div>
      ) : null}
    </div>
  );
};

export default AgreementGrid;
