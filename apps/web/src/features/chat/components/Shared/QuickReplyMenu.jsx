import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
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
import { cn } from '@/lib/utils.js';
import { MessageSquarePlus, Plus } from 'lucide-react';

const sanitizeReply = (reply) => {
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

const QuickReplyMenu = ({ replies = [], onSelect, onCreate, className }) => {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ label: '', text: '' });

  const availableReplies = useMemo(
    () => replies.map((reply) => sanitizeReply(reply)).filter(Boolean),
    [replies]
  );

  const isSubmitDisabled = !form.label.trim() || !form.text.trim();

  const handleSelect = (reply) => {
    if (typeof onSelect === 'function') {
      onSelect(reply.text, reply);
    }
    setOpen(false);
  };

  const handleCreate = (event) => {
    event.preventDefault();
    const payload = sanitizeReply(form);
    if (!payload) {
      return;
    }
    if (typeof onCreate === 'function') {
      onCreate(payload);
    }
    setForm({ label: '', text: '' });
    setDialogOpen(false);
    setOpen(false);
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={(value) => setOpen(value)}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-9 w-9 rounded-full border border-slate-800/60 bg-slate-950/60 text-slate-300 hover:bg-slate-900 hover:text-white',
              className
            )}
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span className="sr-only">Abrir respostas rápidas</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64 rounded-xl border-slate-800/80 bg-slate-950/95 p-2 text-slate-100 shadow-xl"
        >
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Respostas rápidas
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1 bg-slate-900/60" />
          {availableReplies.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">Nenhuma resposta cadastrada ainda.</div>
          ) : (
            availableReplies.map((reply) => (
              <DropdownMenuItem
                key={reply.id}
                className="flex flex-col items-start gap-1 rounded-lg px-3 py-2 text-left text-xs text-slate-300 focus:bg-slate-900 focus:text-slate-100"
                onSelect={(event) => {
                  event.preventDefault();
                  handleSelect(reply);
                }}
              >
                <span className="text-sm font-medium text-slate-100">{reply.label}</span>
                <span className="line-clamp-2 text-xs text-slate-500">{reply.text}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator className="my-1 bg-slate-900/60" />
          <DropdownMenuItem
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wide text-sky-300 focus:bg-slate-900 focus:text-sky-200"
            onSelect={(event) => {
              event.preventDefault();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova resposta rápida
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialogOpen}
        onOpenChange={(value) => {
          setDialogOpen(value);
          if (!value) {
            setForm({ label: '', text: '' });
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-slate-800/80 bg-slate-950/95 text-slate-100">
          <DialogHeader>
            <DialogTitle>Nova resposta rápida</DialogTitle>
            <DialogDescription>
              Crie atalhos para mensagens que você usa com frequência e ganhe velocidade no atendimento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-reply-label" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Nome visível
              </Label>
              <Input
                id="quick-reply-label"
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Ex.: Saudação inicial"
                className="h-10 rounded-lg border-slate-800/60 bg-slate-900/60 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-reply-text" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Mensagem
              </Label>
              <Textarea
                id="quick-reply-text"
                value={form.text}
                onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
                placeholder="Escreva a mensagem completa que será inserida na conversa"
                className="min-h-[120px] rounded-lg border-slate-800/60 bg-slate-900/60 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="border border-slate-800/60 bg-transparent text-slate-300 hover:bg-slate-900"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitDisabled}
                className="bg-sky-600 text-white hover:bg-sky-500"
              >
                Salvar resposta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickReplyMenu;
