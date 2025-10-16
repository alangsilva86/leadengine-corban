import { MessageSquarePlus, NotebookPen } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { ButtonGroup } from '@/components/ui/button-group.jsx';

const EmptyInboxState = ({ onSelectAgreement, onBackToWhatsApp }) => {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-6 rounded-[var(--radius)] border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-10 text-center text-[color:var(--color-inbox-foreground)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-[color:var(--color-inbox-border)] bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_82%,transparent)] text-primary">
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
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[color:var(--color-inbox-foreground-muted)]">
        <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-inbox-border)] bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_72%,transparent)] px-4 py-2">
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
