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
import { Badge } from '@/components/ui/badge.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label.jsx';
import CampaignMetricsGrid from './CampaignMetricsGrid.jsx';
import { statusMeta } from '../utils/campaign-helpers.js';

const DISCONNECT_VALUE = '__disconnect__';

const ReassignCampaignDialog = ({
  open,
  campaign,
  instances,
  onClose,
  onSubmit,
  fetchImpact,
  intent = 'reassign',
}) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState(DISCONNECT_VALUE);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [impactSummary, setImpactSummary] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState(null);

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

    const baseSelection =
      campaign?.instanceId && campaign.instanceId.trim().length > 0
        ? campaign.instanceId
        : DISCONNECT_VALUE;
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
      .then((data) => {
        setImpactSummary(data?.summary ?? null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Não foi possível carregar o impacto.';
        setImpactError(message);
      })
      .finally(() => {
        setImpactLoading(false);
      });
  }, [campaign?.id, campaign?.instanceId, fetchImpact, intent, open]);

  const normalizedSelection =
    selectedInstanceId === DISCONNECT_VALUE ? null : selectedInstanceId;
  const currentInstance = campaign?.instanceId ?? null;
  const hasChanged = (normalizedSelection ?? null) !== (currentInstance ?? null);
  const canSubmit = hasChanged && !submitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      setError('Selecione uma instância diferente ou escolha desvincular a campanha.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit?.({ instanceId: normalizedSelection });
      onClose?.(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível reatribuir a campanha.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusInfo =
    statusMeta[campaign?.status] ?? { label: campaign?.status ?? '—', variant: 'secondary' };
  const agreementLabel = campaign?.agreementName || campaign?.agreementId || '—';
  const currentInstanceLabel =
    campaign?.instanceName || campaign?.instanceId || 'Sem instância vinculada';

  return (
    <Dialog open={open} onOpenChange={(value) => (!submitting ? onClose?.(value) : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atualizar vínculo da campanha</DialogTitle>
          <DialogDescription>
            Escolha qualquer instância conectada ou deixe a campanha aguardando vínculo para pausar temporariamente o roteamento automático.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{campaign?.name}</p>
                <p className="text-xs text-muted-foreground">ID: {campaign?.id}</p>
              </div>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Convênio: {agreementLabel}</p>
            <p className="text-xs text-muted-foreground">
              Instância atual: {currentInstanceLabel}
            </p>
          </div>

          <NoticeBanner tone="warning" icon={<AlertCircle className="h-4 w-4" />}>
            <p>
              Revise o impacto antes de confirmar. Ao desvincular, novos leads ficarão aguardando vínculo; ao reatribuir, eles serão direcionados imediatamente para a instância escolhida.
            </p>
          </NoticeBanner>

          <CampaignMetricsGrid
            loading={impactLoading}
            metrics={
              impactSummary
                ? [
                    { label: 'Leads totais', value: impactSummary.total },
                    { label: 'Contactados', value: impactSummary.contacted },
                    { label: 'Ganhos', value: impactSummary.won },
                    { label: 'Perdidos', value: impactSummary.lost },
                  ]
                : []
            }
            fallback={
              impactError
                ? impactError
                : 'Nenhum lead alocado foi encontrado para essa campanha até o momento.'
            }
          />

          <div className="space-y-2">
            <Label>Nova instância</Label>
            <Select
              value={selectedInstanceId}
              onValueChange={(value) => {
                setSelectedInstanceId(value);
                setError(null);
              }}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a instância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DISCONNECT_VALUE}>Sem instância (aguardando vínculo)</SelectItem>
                {sortedInstances.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name || entry.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecione uma instância conectada ou escolha &quot;Sem instância&quot; para deixar a campanha aguardando vínculo.
            </p>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : null}

          <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={submitting} onClick={() => onClose?.(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? 'Salvando…' : 'Aplicar alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReassignCampaignDialog;
