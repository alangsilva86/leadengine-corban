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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { AlertCircle } from 'lucide-react';

const buildCampaignName = (agreement, instance) => {
  const parts = [];
  if (agreement?.name) {
    parts.push(agreement.name);
  }
  if (instance?.name || instance?.id) {
    parts.push(instance?.name || instance?.id);
  }
  if (parts.length === 0) {
    return 'Nova campanha';
  }
  return parts.join(' • ');
};

const CreateCampaignDialog = ({
  open,
  onOpenChange,
  agreement,
  instances,
  defaultInstanceId,
  onSubmit,
}) => {
  const [instanceId, setInstanceId] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('active');
  const [nameDirty, setNameDirty] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const sortedInstances = useMemo(() => {
    return [...(instances || [])].sort((a, b) => {
      const labelA = a.name || a.id;
      const labelB = b.name || b.id;
      return labelA.localeCompare(labelB);
    });
  }, [instances]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const preferredInstance =
      sortedInstances.find((entry) => entry.id === defaultInstanceId) ?? sortedInstances[0] ?? null;

    setInstanceId(preferredInstance?.id ?? '');
    setStatus('active');
    setName(buildCampaignName(agreement, preferredInstance));
    setNameDirty(false);
    setError(null);
  }, [agreement, defaultInstanceId, open, sortedInstances]);

  useEffect(() => {
    if (!open || nameDirty) {
      return;
    }

    const currentInstance = sortedInstances.find((entry) => entry.id === instanceId) ?? null;
    setName(buildCampaignName(agreement, currentInstance));
  }, [agreement, instanceId, nameDirty, open, sortedInstances]);

  const canSubmit = useMemo(() => {
    return Boolean(instanceId) && name.trim().length > 0;
  }, [instanceId, name]);

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
        instanceId,
        status,
      });
      onOpenChange?.(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível criar a campanha.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const instancesAvailable = sortedInstances.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova campanha do WhatsApp</DialogTitle>
          <DialogDescription>
            Vincule uma instância conectada ao convênio selecionado para que as mensagens inbound gerem leads automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Instância vinculada</Label>
            <Select
              value={instanceId}
              onValueChange={(value) => {
                setInstanceId(value);
                setNameDirty(false);
              }}
              disabled={!instancesAvailable || submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a instância" />
              </SelectTrigger>
              <SelectContent>
                {sortedInstances.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name || entry.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Apenas instâncias conectadas ao convênio podem receber leads desta campanha.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-name">Nome da campanha</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameDirty(true);
              }}
              placeholder="Lead Engine • WhatsApp principal"
              disabled={submitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              O nome aparece nos relatórios e na distribuição automática de leads.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Status inicial</Label>
            <Select value={status} onValueChange={setStatus} disabled={submitting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativa imediatamente</SelectItem>
                <SelectItem value="paused">Criar pausada</SelectItem>
                <SelectItem value="draft">Salvar como rascunho</SelectItem>
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={!canSubmit || submitting || !instancesAvailable}>
              {submitting ? 'Criando…' : 'Criar campanha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCampaignDialog;
