import { useEffect, useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { AlertCircle } from 'lucide-react';

const slugify = (value) => {
  if (!value) {
    return '';
  }
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40);
};

const CreateInstanceDialog = ({
  open,
  onOpenChange,
  defaultName,
  onSubmit,
}) => {
  const suggestedName = defaultName || 'Nova instância';
  const [name, setName] = useState(suggestedName);
  const [identifier, setIdentifier] = useState('');
  const [identifierDirty, setIdentifierDirty] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(suggestedName);
    setIdentifier('');
    setIdentifierDirty(false);
    setError(null);
  }, [open, suggestedName]);

  useEffect(() => {
    if (!open || identifierDirty) {
      return;
    }
    const nextSlug = slugify(name);
    setIdentifier(nextSlug);
  }, [identifierDirty, name, open]);

  const canSubmit = useMemo(() => {
    return name.trim().length > 0;
  }, [name]);

  const handleClose = (nextOpen) => {
    if (submitting) {
      return;
    }
    onOpenChange?.(nextOpen);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit?.({
        name: name.trim(),
        id: identifier.trim() ? identifier.trim() : undefined,
      });
      onOpenChange?.(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível criar a instância.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova instância do WhatsApp</DialogTitle>
          <DialogDescription>
            Defina um nome amigável e, se preferir, personalize o identificador usado nas integrações.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance-name">Nome da instância</Label>
            <Input
              id="instance-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="WhatsApp principal"
              disabled={submitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              Esse nome aparece para os operadores e nas listagens do LeadEngine.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance-id">Identificador (opcional)</Label>
            <Input
              id="instance-id"
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
                setIdentifierDirty(true);
              }}
              placeholder="whatsapp-principal"
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Usaremos esse identificador como slug na API. Utilize apenas letras minúsculas, números e hífens.
            </p>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : null}

          <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={submitting} onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? 'Criando…' : 'Criar instância'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateInstanceDialog;
