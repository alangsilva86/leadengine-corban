import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';

export const ProposalMiniSim = ({ lead, primaryCtaHref }) => {
  const hasPrimaryCta = Boolean(primaryCtaHref);

  return (
    <Card className="border-0 bg-surface-overlay-quiet text-foreground shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-surface-overlay-glass-border backdrop-blur">
      <CardHeader>
        <CardTitle className="text-sm">Proposta rápida</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs text-foreground-muted">
        <div className="flex justify-between">
          <span>Taxa alvo</span>
          <span>{lead?.metadata?.targetRate ?? '1,9% a.m.'}</span>
        </div>
        <div className="flex justify-between">
          <span>Parcelas</span>
          <span>{lead?.metadata?.installments ?? '60x'}</span>
        </div>
        <div className="flex justify-between">
          <span>Valor sugerido</span>
          <span>{lead?.value ? `R$ ${lead.value}` : 'R$ 45.000,00'}</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <p className="text-[11px] text-foreground-muted">
          Utilize o botão &ldquo;Gerar proposta&rdquo; na barra de resumo (atalho G) para criar a minuta com estes parâmetros.
        </p>
        {hasPrimaryCta ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full justify-center gap-2 rounded-full border-surface-overlay-glass-border bg-transparent text-xs font-semibold text-sky-600 hover:text-sky-500"
          >
            <a href={primaryCtaHref} aria-label="Ir para o botão principal de gerar proposta">
              Ir para &ldquo;Gerar proposta&rdquo;
            </a>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
};

export default ProposalMiniSim;
