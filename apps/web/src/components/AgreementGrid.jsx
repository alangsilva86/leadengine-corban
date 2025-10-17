import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { apiGet } from '@/lib/api.js';
import AgreementCard from '@/components/agreements/AgreementCard.jsx';
import AgreementCardSkeleton from '@/components/agreements/AgreementCardSkeleton.jsx';

const AgreementGrid = ({ onboarding, selectedAgreement, onSelect }) => {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const payload = await apiGet('/api/lead-engine/agreements');
        if (!mounted) return;
        setAgreements(payload.data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar convênios');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);
  const stageIndex = onboarding?.stages?.findIndex((stage) => stage.id === 'agreements') ?? 1;
  const totalStages = onboarding?.stages?.length ?? 0;
  const stepNumber = stageIndex >= 0 ? stageIndex + 1 : 2;
  const stepLabel = totalStages ? `Passo ${Math.min(stepNumber, totalStages)} de ${totalStages}` : 'Passo 2';
  const nextStage = onboarding?.stages?.[Math.min(stageIndex + 1, totalStages - 1)]?.label ?? 'WhatsApp';
  const isLoading = loading && agreements.length === 0;

  const handleRetry = async () => {
    try {
      setError(null);
      setLoading(true);
      const payload = await apiGet('/api/lead-engine/agreements');
      setAgreements(payload.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar convênios');
    } finally {
      setLoading(false);
    }
  };

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
            <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(99,102,241,0.12)] px-3 py-1 font-medium text-[color:var(--primary-foreground)]">
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
            <span>Próximo: {nextStage}</span>
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
          <Button size="sm" variant="outline" className="ml-auto" onClick={handleRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => <AgreementCardSkeleton key={`skeleton-${index}`} />)
          : agreements.map((agreement) => (
              <AgreementCard
                key={agreement.id}
                {...agreement}
                tags={agreement.tags ?? []}
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
