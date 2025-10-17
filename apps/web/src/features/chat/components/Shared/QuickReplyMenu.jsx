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
              'h-9 w-9 rounded-full border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)] hover:text-[color:var(--color-inbox-foreground)]',
              className
            )}
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span className="sr-only">Abrir respostas rápidas</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64 rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] p-2 text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-lg)]"
        >
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">
            Respostas rápidas
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1 bg-[color:var(--color-inbox-border)]/70" />
          {availableReplies.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[color:var(--color-inbox-foreground-muted)]">Nenhuma resposta cadastrada ainda.</div>
          ) : (
            availableReplies.map((reply) => (
              <DropdownMenuItem
                key={reply.id}
                className="flex flex-col items-start gap-1 rounded-lg px-3 py-2 text-left text-xs text-[color:var(--color-inbox-foreground)] focus:bg-[color:var(--surface-overlay-inbox-quiet)] focus:text-[color:var(--color-inbox-foreground)]"
                onSelect={(event) => {
                  event.preventDefault();
                  handleSelect(reply);
                }}
              >
                <span className="text-sm font-medium text-[color:var(--color-inbox-foreground)]">{reply.label}</span>
                <span className="line-clamp-2 text-xs text-[color:var(--color-inbox-foreground-muted)]">{reply.text}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator className="my-1 bg-[color:var(--color-inbox-border)]/70" />
          <DropdownMenuItem
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wide text-[color:var(--accent-inbox-primary)] focus:bg-[color:var(--surface-overlay-inbox-quiet)] focus:text-[color:var(--accent-inbox-primary)]"
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
        <DialogContent className="max-w-md rounded-2xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-lg)]">
          <DialogHeader>
            <DialogTitle>Nova resposta rápida</DialogTitle>
            <DialogDescription>
              Crie atalhos para mensagens que você usa com frequência e ganhe velocidade no atendimento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-reply-label" className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">
                Nome visível
              </Label>
              <Input
                id="quick-reply-label"
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Ex.: Saudação inicial"
                className="h-10 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)] placeholder:text-[color:var(--color-inbox-foreground-muted)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-reply-text" className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">
                Mensagem
              </Label>
              <Textarea
                id="quick-reply-text"
                value={form.text}
                onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
                placeholder="Escreva a mensagem completa que será inserida na conversa"
                className="min-h-[120px] rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)] placeholder:text-[color:var(--color-inbox-foreground-muted)]"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="border border-[color:var(--color-inbox-border)] bg-transparent text-[color:var(--color-inbox-foreground-muted)] hover:bg-[color:var(--surface-overlay-inbox-quiet)]"
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
