import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';

const MOCK_TEMPLATES = [
  {
    id: 'template-welcome',
    name: 'Boas-vindas',
    body: 'Olá {{nome}}, sou da Corban. Podemos ajudar com sua proposta?',
  },
  {
    id: 'template-followup',
    name: 'Follow-up 24h',
    body: 'Olá {{nome}}, passando para lembrar do nosso combinado. Podemos prosseguir?',
  },
  {
    id: 'template-docs',
    name: 'Solicitar documentos',
    body: 'Para seguir com a análise, preciso dos documentos anexados. Pode enviar por aqui?',
  },
];

export const TemplatePicker = ({ open, onClose, onSelect }) => {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose?.() : undefined)}>
      <DialogContent className="max-w-md border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-lg)]">
        <DialogHeader>
          <DialogTitle>Selecionar template aprovado</DialogTitle>
          <DialogDescription>Escolha um template aprovado para inserir no chat.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {MOCK_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-3 text-left transition hover:border-[color:var(--accent-inbox-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => onSelect?.(template)}
            >
              <div className="text-sm font-semibold text-[color:var(--color-inbox-foreground)]">{template.name}</div>
              <div className="text-xs text-[color:var(--color-inbox-foreground-muted)]">{template.body}</div>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplatePicker;
