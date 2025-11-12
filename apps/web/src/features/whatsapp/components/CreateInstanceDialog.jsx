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

const CreateInstanceDialog = ({
  open,
  onOpenChange,
  defaultName,
  onSubmit,
}) => {
  const suggestedName = defaultName || 'Novo canal';
  const [name, setName] = useState(suggestedName);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(suggestedName);
    setIdentifier('');
    setError(null);
  }, [open, suggestedName]);

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
        id: identifier ? identifier : undefined,
      });
      onOpenChange?.(false);
    } catch (err) {
      const suggestedId =
        err && typeof err === 'object' && err?.suggestedId
          ? String(err.suggestedId)
          : err && typeof err === 'object' && err?.payload?.error?.details?.suggestedId
            ? String(err.payload.error.details.suggestedId)
            : null;
      if (suggestedId) {
        setIdentifier(suggestedId);
      }
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
          <DialogTitle>Novo canal do WhatsApp</DialogTitle>
          <DialogDescription>
            Defina o nome que aparecerá para o time e personalize, se necessário, o identificador utilizado nas integrações.
          </DialogDescription>
          <p className="mt-2 text-xs text-muted-foreground">
            Após concluir, o canal será listado automaticamente no painel de instâncias para geração de QR Codes e monitoramento.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance-name">Nome do canal</Label>
            <Input
              id="instance-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Canal principal de WhatsApp"
              disabled={submitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              Esse nome aparece para os operadores e nas listagens do Lead Engine.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance-id">Identificador do canal (opcional)</Label>
            <Input
              id="instance-id"
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
              }}
              placeholder="Ex.: whatsapp-vendas"
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Esse identificador será enviado para as integrações exatamente como você digitar.
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
              {submitting ? 'Criando…' : 'Criar canal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateInstanceDialog;
