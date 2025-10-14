import { MessageSquarePlus, NotebookPen } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { ButtonGroup } from '@/components/ui/button-group.jsx';

const EmptyInboxState = ({ onSelectAgreement, onBackToWhatsApp }) => {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-6 rounded-[var(--radius)] border border-white/10 bg-white/5 p-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-white/20 bg-white/10 text-primary">
        <MessageSquarePlus className="h-7 w-7" />
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Sem leads por aqui (ainda!)</h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          Seu WhatsApp conectado já está pronto para receber leads nesta inbox. Assim que um cliente enviar uma mensagem
          para o número integrado, o lead aparecerá automaticamente — mesmo sem campanhas configuradas.
        </p>
        <p className="text-xs text-muted-foreground/90">
          Vincule uma campanha apenas se precisar de roteamento avançado ou segmentação específica dos atendimentos.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
          <NotebookPen className="h-4 w-4" />
          Cada nova conversa no WhatsApp vira um lead aqui automaticamente.
        </span>
      </div>
      <ButtonGroup className="justify-center">
        <Button onClick={onBackToWhatsApp}>Revisar conexão do WhatsApp</Button>
        {onSelectAgreement ? (
          <Button variant="outline" onClick={onSelectAgreement}>
            Vincular campanha para roteamento
          </Button>
        ) : null}
      </ButtonGroup>
    </div>
  );
};

export default EmptyInboxState;
