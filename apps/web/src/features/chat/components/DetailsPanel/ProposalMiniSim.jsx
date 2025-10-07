import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';

export const ProposalMiniSim = ({ lead, onGenerate }) => {
  return (
    <Card className="border-0 bg-slate-950/25 text-slate-100 shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-white/5 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-sm">Proposta rápida</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs text-slate-300">
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
      <CardFooter>
        <Button className="w-full rounded-full bg-sky-500 text-white shadow-[0_18px_36px_-24px_rgba(14,165,233,0.6)] hover:bg-sky-400" size="sm" onClick={() => onGenerate?.()}>
          Gerar minuta
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProposalMiniSim;
