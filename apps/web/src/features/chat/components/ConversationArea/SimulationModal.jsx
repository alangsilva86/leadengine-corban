import { useEffect, useMemo, useRef, useState } from 'react';
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
}) => {
  const [stage, setStage] = useState(defaultValues.stage ?? '');
  const [leadId, setLeadId] = useState(defaultValues.leadId ?? '');
  const [simulationId, setSimulationId] = useState(defaultValues.simulationId ?? '');
  const [snapshotText, setSnapshotText] = useState(formatSnapshot(defaultValues.calculationSnapshot));
  const [metadataText, setMetadataText] = useState(formatSnapshot(defaultValues.metadata));
  const [errors, setErrors] = useState({});
  const stageTriggerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setStage(defaultValues.stage ?? '');
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
    if (disabled) {
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
      stage: stage || null,
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
          {disabled && disabledReason ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {disabledReason}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sales-stage">Estágio</Label>
              <Select value={stage} onValueChange={setStage} disabled={disabled}>
                <SelectTrigger id="sales-stage" ref={stageTriggerRef}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem mudança</SelectItem>
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
                disabled={disabled}
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
                  disabled={disabled}
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
              placeholder="{\n  \"installment\": 250.5\n}"
              disabled={disabled}
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
              placeholder="{\n  \"origin\": \"chat\"\n}"
              disabled={disabled}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || disabled}>
            {isSubmitting ? 'Enviando…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SimulationModal;
