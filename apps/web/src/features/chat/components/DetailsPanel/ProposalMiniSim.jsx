import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';

export const ProposalMiniSim = ({ lead, onGenerate }) => {
  return (
    <Card className="border-slate-800/60 bg-slate-950/80 text-slate-200">
      <CardHeader>
        <CardTitle className="text-sm">Proposta rápida</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs">
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
        <Button className="w-full bg-sky-600 hover:bg-sky-500" size="sm" onClick={() => onGenerate?.()}>
          Gerar minuta
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProposalMiniSim;
