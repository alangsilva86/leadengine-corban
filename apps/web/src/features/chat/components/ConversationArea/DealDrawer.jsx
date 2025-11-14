import { useEffect, useMemo, useState } from 'react';
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
}) => {
  const [stage, setStage] = useState(defaultValues.stage ?? '');
  const [leadId, setLeadId] = useState(defaultValues.leadId ?? '');
  const [simulationId, setSimulationId] = useState(defaultValues.simulationId ?? '');
  const [proposalId, setProposalId] = useState(defaultValues.proposalId ?? '');
  const [closedAt, setClosedAt] = useState(formatClosedAt(defaultValues.closedAt));
  const [snapshotText, setSnapshotText] = useState(formatSnapshot(defaultValues.calculationSnapshot));
  const [metadataText, setMetadataText] = useState(formatSnapshot(defaultValues.metadata));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) {
      return;
    }
    setStage(defaultValues.stage ?? '');
    setLeadId(defaultValues.leadId ?? '');
    setSimulationId(defaultValues.simulationId ?? '');
    setProposalId(defaultValues.proposalId ?? '');
    setClosedAt(formatClosedAt(defaultValues.closedAt));
    setSnapshotText(formatSnapshot(defaultValues.calculationSnapshot));
    setMetadataText(formatSnapshot(defaultValues.metadata));
    setErrors({});
  }, [defaultValues, open]);

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

    const payload = {
      stage: stage || null,
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
    if (disabled && disabledReason) {
      return disabledReason;
    }
    return 'Finalize a negociação registrando o snapshot aprovado e, se desejar, o vínculo com simulação ou proposta.';
  }, [disabled, disabledReason]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="flex h-full max-h-full w-full flex-col sm:max-w-lg">
        <DrawerHeader className="border-b border-border/60 pb-4">
          <DrawerTitle>Registrar deal</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deal-stage">Estágio</Label>
              <Select value={stage} onValueChange={setStage} disabled={disabled}>
                <SelectTrigger id="deal-stage">
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
              <Label htmlFor="deal-lead">Lead (opcional)</Label>
              <Input
                id="deal-lead"
                value={leadId}
                onChange={(event) => setLeadId(event.target.value)}
                placeholder="lead-123"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-simulation">Simulação (opcional)</Label>
              <Input
                id="deal-simulation"
                value={simulationId}
                onChange={(event) => setSimulationId(event.target.value)}
                placeholder="simulation-abc"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-proposal">Proposta (opcional)</Label>
              <Input
                id="deal-proposal"
                value={proposalId}
                onChange={(event) => setProposalId(event.target.value)}
                placeholder="proposal-xyz"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="deal-closedAt">Data de fechamento (opcional)</Label>
              <Input
                id="deal-closedAt"
                type="datetime-local"
                value={closedAt}
                onChange={(event) => setClosedAt(event.target.value)}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
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
              placeholder="{\n  \"approved\": true\n}"
              disabled={disabled}
            />
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="deal-metadata">Metadata (opcional)</Label>
              {errors.metadata ? <span className="text-xs text-rose-400">{errors.metadata}</span> : null}
            </div>
            <Textarea
              id="deal-metadata"
              value={metadataText}
              onChange={(event) => setMetadataText(event.target.value)}
              minRows={4}
              className="font-mono text-xs"
              placeholder="{\n  \"source\": \"crm\"\n}"
              disabled={disabled}
            />
          </div>
        </div>
        <DrawerFooter className="flex items-center justify-between border-t border-border/60 bg-muted/20 py-4">
          <DrawerClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancelar
            </Button>
          </DrawerClose>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || disabled}>
            {isSubmitting ? 'Enviando…' : 'Registrar deal'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default DealDrawer;
