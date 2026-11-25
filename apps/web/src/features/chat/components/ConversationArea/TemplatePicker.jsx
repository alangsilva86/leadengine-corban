import { FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { fillTemplatePlaceholders } from './utils/presentation.js';

const DEFAULT_TEMPLATES = [
  {
    id: 'template-welcome',
    name: 'Boas-vindas',
    body: 'Olá {{nome}}, tudo bem? Aqui é da Corban. Posso te ajudar com sua proposta de consignado?',
  },
  {
    id: 'template-followup',
    name: 'Retomar contato',
    body: 'Olá {{nome}}, passando para lembrar do nosso combinado. Podemos seguir com a sua proposta?',
  },
  {
    id: 'template-docs',
    name: 'Solicitar documentos',
    body: 'Para seguir com a análise, preciso de uma foto do seu documento com foto e do último contracheque. Pode enviar por aqui?',
  },
];

/**
 * Modelos de mensagem. Escolher um modelo INSERE o texto no campo de mensagem
 * (com o nome do cliente preenchido) — o atendente revisa e envia. Nunca envia sozinho.
 */
export const TemplatePicker = ({ open, onClose, onSelect, contactName = null, templates = DEFAULT_TEMPLATES }) => (
  <Dialog open={open} onOpenChange={(next) => (!next ? onClose?.() : undefined)}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Modelos de mensagem</DialogTitle>
        <DialogDescription>Escolha um modelo para inserir na mensagem. Você revisa antes de enviar.</DialogDescription>
      </DialogHeader>
      <ul className="flex flex-col gap-2">
        {templates.map((template) => {
          const preview = fillTemplatePlaceholders(template.body, { contactName });
          return (
            <li key={template.id}>
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSelect?.({ ...template, body: preview })}
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{template.name}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{preview}</span>
                </span>
                <span className="shrink-0 self-center text-xs font-medium text-primary">Inserir</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

export default TemplatePicker;
