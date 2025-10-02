import { MessageSquarePlus, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

const EmptyInboxState = ({
  onSelectAgreement,
  onBackToWhatsApp,
  onPull,
  pulling,
  campaign,
  agreement,
}) => {
  const agreementName = agreement?.name ?? 'seu convênio favorito';
  const campaignName = campaign?.name ?? 'campanha recém-criada';

  return (
    <div className="flex h-full flex-col items-center justify-center space-y-6 rounded-[var(--radius)] border border-white/10 bg-white/5 p-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-white/20 bg-white/10 text-primary">
        <MessageSquarePlus className="h-7 w-7" />
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Sem leads por aqui (ainda!)</h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          A campanha <span className="font-medium text-foreground">{campaignName}</span> foi registrada
          com sucesso para o convênio <span className="font-medium text-foreground">{agreementName}</span>.
          Assim que o broker entregar novos contatos, eles aparecerão aqui como mágica ✨.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
          <NotebookPen className="h-4 w-4" />
          Dica: clique em “Buscar agora” no painel de convênios para pedir um lote fresquinho.
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onPull} disabled={pulling}>
          {pulling ? 'Consultando broker...' : 'Buscar agora'}
        </Button>
        <Button variant="secondary" onClick={onBackToWhatsApp}>
          Revisar WhatsApp conectado
        </Button>
        <Button variant="outline" onClick={onSelectAgreement}>
          Trocar convênio
        </Button>
      </div>
    </div>
  );
};

export default EmptyInboxState;
