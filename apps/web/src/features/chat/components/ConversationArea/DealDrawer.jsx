import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';

const NO_STAGE_VALUE = '__none__';

const normalizeStageState = (value) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return NO_STAGE_VALUE;
};

const resolveStageValue = (value) => {
  if (typeof value === 'string' && value !== NO_STAGE_VALUE && value.trim().length > 0) {
    return value.trim();
  }
  return '';
};

const formatSnapshot = (value) => {
  if (!value || typeof value !== 'object') {
    return '';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
};

const formatClosedAt = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 16);
};

const DealDrawer = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
  stageOptions = [],
  isSubmitting = false,
  disabled = false,
  disabledReason = null,
  queueAlerts = [],
}) => {
  const [stage, setStage] = useState(() => normalizeStageState(defaultValues.stage));
  const [leadId, setLeadId] = useState(defaultValues.leadId ?? '');
  const [simulationId, setSimulationId] = useState(defaultValues.simulationId ?? '');
  const [proposalId, setProposalId] = useState(defaultValues.proposalId ?? '');
  const [closedAt, setClosedAt] = useState(formatClosedAt(defaultValues.closedAt));
  const [snapshotText, setSnapshotText] = useState(formatSnapshot(defaultValues.calculationSnapshot));
  const [metadataText, setMetadataText] = useState(formatSnapshot(defaultValues.metadata));
  const [errors, setErrors] = useState({});

  const normalizedAlerts = useMemo(() => {
    if (!Array.isArray(queueAlerts)) {
      return [];
    }

    return queueAlerts
      .map((entry) => {
        const payload = entry && typeof entry === 'object' ? entry.payload ?? {} : {};
        const message =
          payload && typeof payload.message === 'string' && payload.message.trim().length > 0
            ? payload.message.trim()
            : 'Fila padrão indisponível para registrar deals.';
        const reason =
          payload && typeof payload.reason === 'string' && payload.reason.trim().length > 0
            ? payload.reason.trim()
            : null;
        const instanceId =
          payload && typeof payload.instanceId === 'string' && payload.instanceId.trim().length > 0
            ? payload.instanceId.trim()
            : null;

        return {
          message,
          reason,
          instanceId,
        };
      })
      .slice(0, 3);
  }, [queueAlerts]);
  const alertsActive = normalizedAlerts.length > 0;
  const fieldsDisabled = disabled || alertsActive;

  useEffect(() => {
    if (!open) {
      return;
    }
    setStage(normalizeStageState(defaultValues.stage));
    setLeadId(defaultValues.leadId ?? '');
    setSimulationId(defaultValues.simulationId ?? '');
    setProposalId(defaultValues.proposalId ?? '');
    setClosedAt(formatClosedAt(defaultValues.closedAt));
    setSnapshotText(formatSnapshot(defaultValues.calculationSnapshot));
    setMetadataText(formatSnapshot(defaultValues.metadata));
    setErrors({});
  }, [defaultValues, open]);

  const handleSubmit = async () => {
    if (fieldsDisabled) {
      return;
    }

    const nextErrors = {};
    let calculationSnapshot = null;
    let metadata = null;

    try {
      calculationSnapshot = snapshotText ? JSON.parse(snapshotText) : null;
    } catch {
      nextErrors.calculationSnapshot = 'Informe um JSON válido para o snapshot de cálculo.';
    }

    if (!calculationSnapshot || typeof calculationSnapshot !== 'object') {
      nextErrors.calculationSnapshot = 'Snapshot de cálculo é obrigatório.';
    }

    if (metadataText.trim().length > 0) {
      try {
        const parsed = JSON.parse(metadataText);
        if (parsed && typeof parsed === 'object') {
          metadata = parsed;
        }
      } catch {
        nextErrors.metadata = 'Metadata deve ser um JSON válido.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      stage: resolveStageValue(stage) || null,
      leadId: leadId?.trim() ? leadId.trim() : null,
      simulationId: simulationId?.trim() ? simulationId.trim() : null,
      proposalId: proposalId?.trim() ? proposalId.trim() : null,
      closedAt: closedAt ? new Date(closedAt).toISOString() : null,
      calculationSnapshot,
      metadata,
    };

    await onSubmit?.(payload);
  };

  const description = useMemo(() => {
    if (fieldsDisabled && disabledReason) {
      return disabledReason;
    }
    return 'Finalize a negociação registrando o snapshot aprovado e, se desejar, o vínculo com simulação ou proposta.';
  }, [disabledReason, fieldsDisabled]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="flex h-full max-h-full w-full flex-col sm:max-w-lg">
        <DrawerHeader className="border-b border-border/60 pb-4">
          <DrawerTitle>Registrar deal</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-4">
            {alertsActive ? (
              <div className="space-y-2">
                {normalizedAlerts.map((alert, index) => (
                  <Alert
                    key={`${alert.reason ?? 'missing'}-${alert.instanceId ?? index}`}
                    className="border-amber-300/80 bg-amber-50 text-amber-900"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
                    <AlertTitle>Fila padrão indisponível</AlertTitle>
                    <AlertDescription>
                      <p>{alert.message}</p>
                      {alert.instanceId ? (
                        <p className="text-xs text-amber-800/90">
                          Instância afetada: <span className="font-semibold">{alert.instanceId}</span>
                        </p>
                      ) : null}
                      {alert.reason ? (
                        <p className="text-xs uppercase tracking-wide text-amber-700/70">
                          Código: {alert.reason}
                        </p>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deal-stage">Estágio</Label>
                <Select value={stage} onValueChange={setStage} disabled={fieldsDisabled}>
                  <SelectTrigger id="deal-stage">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_STAGE_VALUE}>Sem mudança</SelectItem>
                    {stageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-lead">Lead (opcional)</Label>
                <Input
                  id="deal-lead"
                  value={leadId}
                  onChange={(event) => setLeadId(event.target.value)}
                  placeholder="lead-123"
                  disabled={fieldsDisabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-simulation">Simulação (opcional)</Label>
                <Input
                  id="deal-simulation"
                  value={simulationId}
                  onChange={(event) => setSimulationId(event.target.value)}
                  placeholder="simulation-abc"
                  disabled={fieldsDisabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-proposal">Proposta (opcional)</Label>
                <Input
                  id="deal-proposal"
                  value={proposalId}
                  onChange={(event) => setProposalId(event.target.value)}
                  placeholder="proposal-xyz"
                  disabled={fieldsDisabled}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="deal-closedAt">Data de fechamento (opcional)</Label>
                <Input
                  id="deal-closedAt"
                  type="datetime-local"
                  value={closedAt}
                  onChange={(event) => setClosedAt(event.target.value)}
                  disabled={fieldsDisabled}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="deal-snapshot">Snapshot de cálculo *</Label>
                {errors.calculationSnapshot ? (
                  <span className="text-xs text-rose-400">{errors.calculationSnapshot}</span>
                ) : null}
              </div>
              <Textarea
                id="deal-snapshot"
                value={snapshotText}
                onChange={(event) => setSnapshotText(event.target.value)}
                minRows={6}
                className="font-mono text-xs"
                placeholder={`{
  "approved": true
}`}
                disabled={fieldsDisabled}
              />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="deal-metadata">Metadata (opcional)</Label>
                {errors.metadata ? (
                  <span className="text-xs text-rose-400">{errors.metadata}</span>
                ) : null}
              </div>
              <Textarea
                id="deal-metadata"
                value={metadataText}
                onChange={(event) => setMetadataText(event.target.value)}
                minRows={4}
                className="font-mono text-xs"
                placeholder={`{
  "source": "crm"
}`}
                disabled={fieldsDisabled}
              />
            </div>
          </div>
        </div>
        <DrawerFooter className="flex items-center justify-between border-t border-border/60 bg-muted/20 py-4">
          <DrawerClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancelar
            </Button>
          </DrawerClose>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || fieldsDisabled}>
            {isSubmitting ? 'Enviando…' : 'Registrar deal'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default DealDrawer;
