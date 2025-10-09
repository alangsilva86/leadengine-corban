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
import { Skeleton } from '@/components/ui/skeleton.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label.jsx';

const formatNumber = (value) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value ?? 0);

const statusMeta = {
  active: { label: 'Ativa', variant: 'success' },
  paused: { label: 'Pausada', variant: 'warning' },
  draft: { label: 'Rascunho', variant: 'info' },
  ended: { label: 'Encerrada', variant: 'secondary' },
};

const ReassignCampaignDialog = ({
  open,
  campaign,
  instances,
  onClose,
  onSubmit,
  fetchImpact,
}) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
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

    setSelectedInstanceId(campaign?.instanceId ?? '');
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
  }, [campaign?.id, campaign?.instanceId, fetchImpact, open]);

  const canSubmit =
    Boolean(selectedInstanceId) &&
    selectedInstanceId !== (campaign?.instanceId ?? null) &&
    !submitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      setError('Selecione uma instância diferente para concluir a reatribuição.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit?.({ instanceId: selectedInstanceId });
      onClose?.(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível reatribuir a campanha.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusInfo = statusMeta[campaign?.status] ?? { label: campaign?.status ?? '—', variant: 'secondary' };

  return (
    <Dialog open={open} onOpenChange={(value) => (!submitting ? onClose?.(value) : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reatribuir campanha</DialogTitle>
          <DialogDescription>
            Redirecione a campanha para outra instância conectada. Mensagens inbound passarão a buscar campanhas ativas na nova instância selecionada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{campaign?.name}</p>
                <p className="text-xs text-muted-foreground">ID: {campaign?.id}</p>
              </div>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Instância atual: {campaign?.instanceName || campaign?.instanceId || '—'}
            </p>
          </div>

          <NoticeBanner tone="warning" icon={<AlertCircle className="h-4 w-4" />}>
            <p>
              Antes de confirmar, revise o impacto abaixo. Todos os tickets e leads futuros passarão a ser associados à instância escolhida.
            </p>
          </NoticeBanner>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {impactLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-lg" />
              ))
            ) : impactSummary ? (
              [
                { label: 'Leads totais', value: impactSummary.total },
                { label: 'Contactados', value: impactSummary.contacted },
                { label: 'Ganhos', value: impactSummary.won },
                { label: 'Perdidos', value: impactSummary.lost },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-white/10 bg-white/5 p-3 text-center"
                >
                  <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {formatNumber(item.value)}
                  </p>
                </div>
              ))
            ) : (
              <div className="sm:col-span-2 lg:col-span-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                {impactError
                  ? impactError
                  : 'Nenhum lead alocado foi encontrado para essa campanha até o momento.'}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Nova instância</Label>
            <Select
              value={selectedInstanceId}
              onValueChange={(value) => {
                setSelectedInstanceId(value);
                setError(null);
              }}
              disabled={submitting || sortedInstances.length === 0}
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
              A campanha permanecerá ativa, mas buscará dados na nova instância após a confirmação.
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
              {submitting ? 'Reatribuindo…' : 'Confirmar reatribuição'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReassignCampaignDialog;
