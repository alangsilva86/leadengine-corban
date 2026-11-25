import { useEffect, useId, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Label } from '@/components/ui/label.jsx';

import CampaignMetricsGrid from './CampaignMetricsGrid.jsx';
import { NumberStatusDot } from './numbers/NumberStatusBadge';
import { getNumberStatus } from '../lib/numberStatus';
import { formatWhatsAppNumber } from '@/lib/phone';
import { resolveInstancePhone } from '../lib/instances';
import { resolveWhatsAppError } from '../lib/errors';
import { resolveCampaignTitle } from './CampaignCard.jsx';

const DISCONNECT_VALUE = '__disconnect__';

const labelFor = (instance) => {
  const name = typeof instance?.name === 'string' && instance.name.trim() ? instance.name.trim() : null;
  return name ?? formatWhatsAppNumber(resolveInstancePhone(instance)) ?? 'Número sem nome';
};

/**
 * Trocar (ou remover) o número que recebe os leads de uma regra.
 * Mostra o impacto (leads já distribuídos) antes de confirmar.
 */
const ReassignCampaignDialog = ({ open, campaign, instances, onClose, onSubmit, fetchImpact, intent = 'reassign' }) => {
  const fieldId = useId();
  const [selectedInstanceId, setSelectedInstanceId] = useState(DISCONNECT_VALUE);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [impactSummary, setImpactSummary] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState(null);

  const options = useMemo(
    () =>
      [...(instances || [])]
        .filter((entry) => entry && typeof entry.id === 'string')
        .map((entry) => ({
          id: entry.id,
          label: labelFor(entry),
          phone: formatWhatsAppNumber(resolveInstancePhone(entry)),
          status: getNumberStatus(entry),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [instances],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const baseSelection =
      campaign?.instanceId && campaign.instanceId.trim().length > 0 ? campaign.instanceId : DISCONNECT_VALUE;
    setSelectedInstanceId(intent === 'disconnect' ? DISCONNECT_VALUE : baseSelection);
    setError(null);
    setSubmitting(false);
    setImpactSummary(null);
    setImpactError(null);

    if (!campaign?.id || typeof fetchImpact !== 'function') {
      return;
    }

    setImpactLoading(true);
    fetchImpact(campaign.id)
      .then((data) => setImpactSummary(data?.summary ?? null))
      .catch((err) => setImpactError(resolveWhatsAppError(err, 'Não foi possível carregar os números da regra').message))
      .finally(() => setImpactLoading(false));
  }, [campaign?.id, campaign?.instanceId, fetchImpact, intent, open]);

  const normalizedSelection = selectedInstanceId === DISCONNECT_VALUE ? null : selectedInstanceId;
  const currentInstance = campaign?.instanceId ?? null;
  const hasChanged = (normalizedSelection ?? null) !== (currentInstance ?? null);
  const selectedOption = options.find((option) => option.id === normalizedSelection) ?? null;
  const selectedOffline = Boolean(selectedOption && !selectedOption.status.isConnected);
  const canSubmit = hasChanged && !submitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      setError('Escolha um número diferente do atual.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit?.({ instanceId: normalizedSelection });
      onClose?.(false);
    } catch (err) {
      setError(resolveWhatsAppError(err, 'Não foi possível trocar o número').message);
    } finally {
      setSubmitting(false);
    }
  };

  const title = campaign ? resolveCampaignTitle(campaign) : '';

  return (
    <Dialog open={open} onOpenChange={(value) => (!submitting ? onClose?.(value) : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{currentInstance ? 'Trocar número' : 'Escolher número'}</DialogTitle>
          <DialogDescription>
            Os próximos leads de <span className="font-medium text-foreground">{title}</span> vão para o número escolhido.
            Conversas já abertas continuam onde estão.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor={fieldId}>Número de destino</Label>
            <Select
              value={selectedInstanceId}
              onValueChange={(value) => {
                setSelectedInstanceId(value);
                setError(null);
              }}
              disabled={submitting}
            >
              <SelectTrigger id={fieldId} className="w-full">
                <SelectValue placeholder="Escolha um número" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <span className="flex items-center gap-2">
                      <NumberStatusDot status={option.status} />
                      {option.label}
                      {option.phone ? <span className="text-muted-foreground">{option.phone}</span> : null}
                      {!option.status.isConnected ? (
                        <span className="text-xs text-muted-foreground">· {option.status.label}</span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
                <SelectItem value={DISCONNECT_VALUE}>Sem número (pausa a distribuição)</SelectItem>
              </SelectContent>
            </Select>
            {selectedOffline ? (
              <p className="text-xs text-warning-soft-foreground">
                Este número não está conectado. Os leads ficam aguardando até ele ser reconectado.
              </p>
            ) : normalizedSelection === null ? (
              <p className="text-xs text-muted-foreground">Sem número, novos leads desta origem ficam aguardando distribuição.</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Até agora nesta regra</p>
            <CampaignMetricsGrid
              loading={impactLoading}
              metrics={
                impactSummary
                  ? [
                      { label: 'Leads', value: impactSummary.total },
                      { label: 'Contactados', value: impactSummary.contacted },
                      { label: 'Convertidos', value: impactSummary.won },
                    ]
                  : []
              }
              fallback={impactError ?? 'Nenhum lead distribuído por esta regra ainda.'}
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={submitting} onClick={() => onClose?.(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {normalizedSelection === null && currentInstance ? 'Remover número' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReassignCampaignDialog;
