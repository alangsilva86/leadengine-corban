import { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';

export const DEFAULT_QUICK_REPLIES = [
  { id: 'hello', label: 'Saudação', text: 'Olá {{nome}}! Aqui é da Corban, tudo bem?' },
  { id: 'docs', label: 'Solicitar documentos', text: 'Pode me enviar os documentos para darmos andamento?' },
  { id: 'followup', label: 'Lembrete', text: 'Estou passando para lembrar do nosso combinado.' },
  { id: 'thanks', label: 'Agradecimento', text: 'Obrigado pelo retorno, {{nome}}! Qualquer dúvida, é só chamar.' },
];

export const sanitizeQuickReply = (reply) => {
  if (!reply) return null;
  const label = reply.label?.trim();
  const text = reply.text?.trim();
  if (!label || !text) return null;
  return {
    id: reply.id ?? `quick-reply-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    label,
    text,
  };
};

/** Diálogo para criar uma resposta rápida (aparece no "/" do composer). */
export const NewQuickReplyDialog = ({ open, onOpenChange, onCreate }) => {
  const [form, setForm] = useState({ label: '', text: '' });
  const isSubmitDisabled = !form.label.trim() || !form.text.trim();

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = sanitizeQuickReply(form);
    if (!payload) return;
    onCreate?.(payload);
    setForm({ label: '', text: '' });
    onOpenChange?.(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange?.(value);
        if (!value) setForm({ label: '', text: '' });
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova resposta rápida</DialogTitle>
          <DialogDescription>
            Use “/” no campo de mensagem para inserir. Escreva {'{{nome}}'} para usar o primeiro nome do cliente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="quick-reply-label">Nome</Label>
            <Input
              id="quick-reply-label"
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              placeholder="Ex.: Saudação inicial"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-reply-text">Mensagem</Label>
            <Textarea
              id="quick-reply-text"
              value={form.text}
              onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
              placeholder="Texto que será inserido na conversa"
              className="min-h-28"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              Salvar resposta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewQuickReplyDialog;
