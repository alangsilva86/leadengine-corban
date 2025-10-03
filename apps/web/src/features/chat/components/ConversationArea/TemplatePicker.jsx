import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
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
      <DialogContent className="max-w-md bg-slate-950/90 text-slate-100">
        <DialogHeader>
          <DialogTitle>Selecionar template aprovado</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {MOCK_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3 text-left hover:border-sky-500/60 hover:bg-slate-900"
              onClick={() => onSelect?.(template)}
            >
              <div className="text-sm font-semibold text-slate-100">{template.name}</div>
              <div className="text-xs text-slate-400">{template.body}</div>
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
