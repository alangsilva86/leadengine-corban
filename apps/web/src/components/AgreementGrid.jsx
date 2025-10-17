import { useEffect, useState } from 'react';
import { MapPin, ArrowRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { apiGet } from '@/lib/api.js';
import { Skeleton } from '@/components/ui/skeleton.jsx';

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
            <span className="inline-flex items-center gap-2 rounded-full border borderToneInfoBorder bgToneInfoSurface px-3 py-1 font-medium textToneInfoForeground">
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
          ? Array.from({ length: 3 }).map((_, index) => (
              <Card key={`skeleton-${index}`} className="borderBorder">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-44" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <div className="space-y-2 text-right">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-9 w-32 rounded-full" />
                </CardFooter>
              </Card>
            ))
          : agreements.map((agreement) => {
              const isSelected = selectedAgreement?.id === agreement.id;
              return (
                <Card
                  key={agreement.id}
                  className={`transition-colors duration-200 ${
                    isSelected ? 'borderToneInfoBorder shadow-brand-ring' : 'borderBorder'
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg font-semibold">{agreement.name}</CardTitle>
                        <CardDescription>{agreement.description}</CardDescription>
                      </div>
                      <Badge variant={isSelected ? 'secondary' : 'info'}>
                        <MapPin className="mr-1 h-3 w-3" />
                        {agreement.region}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-muted-foreground">Leads disponíveis</p>
                        <p className="text-lg font-semibold text-foreground">{agreement.availableLeads}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Leads quentes</p>
                        <p className="text-lg font-semibold text-foreground">{agreement.hotLeads}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {agreement.tags?.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Atualizado em {agreement.lastSyncAt ? new Date(agreement.lastSyncAt).toLocaleString() : '—'}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onSelect?.(agreement)}
                      variant={isSelected ? 'default' : 'outline'}
                    >
                      {isSelected ? 'Convênio selecionado' : 'Ativar leads'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
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
