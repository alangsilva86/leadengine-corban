import { useEffect, useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.jsx';
import { Label } from '@/components/ui/label.jsx';
import { cn } from '@/lib/utils.js';
import { formatRelativeShort } from '@/lib/relative-time';
import { formatPhone } from '@/lib/phone';

/**
 * Pré-visualização + confirmação da mesclagem de contatos duplicados (POST /api/contacts/merge).
 * O contato principal é mantido; os demais são apagados e seus dados (telefones, conversas, tarefas,
 * leads, oportunidades) passam para o principal. A API recusa contatos com CPFs diferentes.
 */
const ContactMergeDialog = ({ open, onOpenChange, contacts = [], onConfirm, isSubmitting = false }) => {
  const [targetId, setTargetId] = useState(null);
  const groupId = useId();

  useEffect(() => {
    if (open) {
      const mostRecent = [...contacts].sort(
        (a, b) => new Date(b.lastInteractionAt ?? 0).getTime() - new Date(a.lastInteractionAt ?? 0).getTime()
      )[0];
      setTargetId(mostRecent?.id ?? null);
    }
  }, [open]);

  const sources = contacts.filter((contact) => contact.id !== targetId);
  const target = contacts.find((contact) => contact.id === targetId);

  return (
    <Dialog open={open} onOpenChange={(next) => (!isSubmitting ? onOpenChange?.(next) : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mesclar contatos duplicados</DialogTitle>
          <DialogDescription>
            Escolha o contato principal. Conversas, tarefas, leads e oportunidades dos outros passam para ele.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={targetId ?? ''} onValueChange={setTargetId} aria-label="Contato principal" className="gap-2">
          {contacts.map((contact) => {
            const id = `${groupId}-${contact.id}`;
            const selected = contact.id === targetId;
            const details = [
              formatPhone(contact.phone),
              contact.email,
              contact.lastInteractionAt ? `última interação ${formatRelativeShort(contact.lastInteractionAt)}` : null,
            ].filter(Boolean);
            return (
              <Label
                key={contact.id}
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 font-normal hover:bg-surface-hover',
                  selected && 'border-primary bg-primary-soft/50'
                )}
              >
                <RadioGroupItem id={id} value={contact.id} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {contact.name || 'Contato sem nome'}
                    {selected ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-2xs font-medium text-primary-foreground">
                        Principal
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground tabular-nums">
                    {details.length ? details.join(' · ') : 'Sem telefone ou e-mail'}
                  </span>
                </span>
              </Label>
            );
          })}
        </RadioGroup>

        <div className="flex gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning-soft-foreground" role="note">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Não dá para desfazer. {sources.length === 1 ? '1 contato será removido' : `${sources.length} contatos serão removidos`}{' '}
            e unificado{sources.length === 1 ? '' : 's'} em {target?.name ?? 'o contato principal'}.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!targetId || sources.length === 0 || isSubmitting}
            onClick={() => onConfirm?.({ targetId, sourceIds: sources.map((contact) => contact.id) })}
          >
            {isSubmitting ? 'Mesclando…' : `Mesclar ${contacts.length} contatos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContactMergeDialog;
