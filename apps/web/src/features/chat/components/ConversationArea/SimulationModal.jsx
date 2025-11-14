import { useEffect, useMemo, useRef, useState } from 'react';
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

const SimulationModal = ({
  open,
  mode = 'simulation',
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
  const [snapshotText, setSnapshotText] = useState(formatSnapshot(defaultValues.calculationSnapshot));
  const [metadataText, setMetadataText] = useState(formatSnapshot(defaultValues.metadata));
  const [errors, setErrors] = useState({});
  const stageTriggerRef = useRef(null);

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
            : 'Fila padrão indisponível para registrar operações de vendas.';
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
    setSnapshotText(formatSnapshot(defaultValues.calculationSnapshot));
    setMetadataText(formatSnapshot(defaultValues.metadata));
    setErrors({});
  }, [defaultValues, open]);

  const title = useMemo(
    () => (mode === 'proposal' ? 'Gerar proposta' : 'Registrar simulação'),
    [mode],
  );

  const description = useMemo(
    () =>
      mode === 'proposal'
        ? 'Defina o estágio e anexe o snapshot de cálculo que será enviado para o CRM.'
        : 'Preencha os dados utilizados na simulação para manter o histórico de vendas atualizado.',
    [mode],
  );

  const submitLabel = useMemo(() => (mode === 'proposal' ? 'Gerar proposta' : 'Registrar simulação'), [mode]);

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

    setErrors({});

    const payload = {
      stage: resolveStageValue(stage) || null,
      leadId: leadId?.trim() ? leadId.trim() : null,
      calculationSnapshot,
      metadata,
    };

    if (mode === 'proposal') {
      payload.simulationId = simulationId?.trim() ? simulationId.trim() : null;
    }

    await onSubmit?.(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
          {disabled && disabledReason ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {disabledReason}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sales-stage">Estágio</Label>
              <Select value={stage} onValueChange={setStage} disabled={fieldsDisabled}>
                <SelectTrigger id="sales-stage" ref={stageTriggerRef}>
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
              <Label htmlFor="sales-lead">Lead (opcional)</Label>
              <Input
                id="sales-lead"
                value={leadId}
                onChange={(event) => setLeadId(event.target.value)}
                placeholder="lead-123"
                disabled={fieldsDisabled}
              />
            </div>
            {mode === 'proposal' ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sales-simulation">Simulação vinculada (opcional)</Label>
                <Input
                  id="sales-simulation"
                  value={simulationId}
                  onChange={(event) => setSimulationId(event.target.value)}
                  placeholder="simulation-abc"
                  disabled={fieldsDisabled}
                />
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sales-snapshot">Snapshot de cálculo *</Label>
              {errors.calculationSnapshot ? (
                <span className="text-xs text-rose-400">{errors.calculationSnapshot}</span>
              ) : null}
            </div>
              <Textarea
                id="sales-snapshot"
                value={snapshotText}
                onChange={(event) => setSnapshotText(event.target.value)}
                minRows={6}
                className="font-mono text-xs"
                placeholder={`{
  "installment": 250.5
}`}
                disabled={fieldsDisabled}
              />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sales-metadata">Metadata (opcional)</Label>
              {errors.metadata ? (
                <span className="text-xs text-rose-400">{errors.metadata}</span>
              ) : null}
            </div>
              <Textarea
                id="sales-metadata"
                value={metadataText}
                onChange={(event) => setMetadataText(event.target.value)}
                minRows={4}
                className="font-mono text-xs"
                placeholder={`{
  "origin": "chat"
}`}
                disabled={fieldsDisabled}
              />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || fieldsDisabled}
          >
            {isSubmitting ? 'Enviando…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SimulationModal;
