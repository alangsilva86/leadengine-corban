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
import {
  buildDealSnapshot,
  normalizeDealSnapshot,
  normalizeProposalSnapshot,
} from './utils/salesSnapshot.js';

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

const formatClosedDate = (value) => {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
};

const toIsoString = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const FINAL_STAGE_HINTS = ['ganho', 'concluido', 'liquid', 'aprovado'];

const useQueueAlerts = (queueAlerts) =>
  useMemo(() => {
    if (!Array.isArray(queueAlerts)) {
      return [];
    }

    return queueAlerts
      .map((entry, index) => {
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
          index,
        };
      })
      .slice(0, 3);
  }, [queueAlerts]);

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
  const [closedAt, setClosedAt] = useState(formatClosedDate(defaultValues.closedAt));
  const [bankName, setBankName] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [term, setTerm] = useState('');
  const [installment, setInstallment] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [metadataText, setMetadataText] = useState('');
  const [proposalContext, setProposalContext] = useState(null);
  const [errors, setErrors] = useState({});

  const normalizedAlerts = useQueueAlerts(queueAlerts);
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
    setClosedAt(formatClosedDate(defaultValues.closedAt));
    setMetadataText(
      defaultValues.metadata && typeof defaultValues.metadata === 'object'
        ? JSON.stringify(defaultValues.metadata, null, 2)
        : '',
    );

    const dealSnapshot = normalizeDealSnapshot(defaultValues.calculationSnapshot);
    const proposalSnapshot = normalizeProposalSnapshot(
      defaultValues.proposalSnapshot ?? defaultValues.calculationSnapshot,
    );

    setProposalContext(proposalSnapshot ?? null);

    setBankName(dealSnapshot?.bank?.label ?? proposalSnapshot?.selected?.[0]?.bankName ?? '');
    setProductLabel(proposalSnapshot?.product?.label ?? dealSnapshot?.product?.label ?? '');
    setTerm(dealSnapshot?.term ? String(dealSnapshot.term) : '');
    setInstallment(dealSnapshot?.installment ? String(dealSnapshot.installment) : '');
    setNetAmount(dealSnapshot?.netAmount ? String(dealSnapshot.netAmount) : '');
    setTotalAmount(dealSnapshot?.totalAmount ? String(dealSnapshot.totalAmount) : '');
    setErrors({});
  }, [defaultValues, open]);

  const snapshotPreview = useMemo(() => {
    const proposal = proposalContext ?? {
      proposalId,
      simulationId,
      convenio: {},
      product: { label: productLabel },
    };

    const snapshot = buildDealSnapshot({
      proposal: {
        proposalId,
        simulationId,
        convenio: proposal?.convenio ?? {},
        product: proposal?.product ?? {},
      },
      bank: bankName,
      term,
      installment,
      netAmount,
      totalAmount,
      closedAt: closedAt ? toIsoString(closedAt) : null,
    });

    return JSON.stringify(snapshot, null, 2);
  }, [bankName, closedAt, installment, netAmount, proposalContext, proposalId, productLabel, simulationId, term, totalAmount]);

  const normalizedAlertsActive = alertsActive;

  const description = useMemo(() => {
    if (fieldsDisabled && disabledReason) {
      return disabledReason;
    }
    return 'Finalize a negociação registrando os dados aprovados e a data de fechamento.';
  }, [disabledReason, fieldsDisabled]);

  const validateForm = () => {
    const nextErrors = {};

    if (!bankName.trim()) {
      nextErrors.bank = 'Informe o banco aprovado.';
    }

    if (!term.trim()) {
      nextErrors.term = 'Informe o prazo.';
    }

    if (!installment.trim()) {
      nextErrors.installment = 'Informe a parcela.';
    }

    if (!netAmount.trim()) {
      nextErrors.netAmount = 'Informe o valor líquido.';
    }

    const resolvedStage = resolveStageValue(stage);
    const mustHaveClosedAt = FINAL_STAGE_HINTS.some((hint) => resolvedStage.includes(hint));
    if (mustHaveClosedAt && !closedAt) {
      nextErrors.closedAt = 'Informe a data de fechamento.';
    }

    if (metadataText.trim().length > 0) {
      try {
        const parsed = JSON.parse(metadataText);
        if (!parsed || typeof parsed !== 'object') {
          nextErrors.metadata = 'Metadata deve ser um JSON válido.';
        }
      } catch {
        nextErrors.metadata = 'Metadata deve ser um JSON válido.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (fieldsDisabled || isSubmitting) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    let metadata = null;
    if (metadataText.trim().length > 0) {
      try {
        metadata = JSON.parse(metadataText);
      } catch {
        metadata = null;
      }
    }

    const snapshot = buildDealSnapshot({
      proposal: proposalContext ?? {
        proposalId,
        simulationId,
        convenio: {},
        product: { label: productLabel },
      },
      bank: bankName,
      term,
      installment,
      netAmount,
      totalAmount,
      closedAt: closedAt ? toIsoString(closedAt) : null,
    });

    const payload = {
      stage: resolveStageValue(stage) || null,
      leadId: leadId?.trim() ? leadId.trim() : null,
      simulationId: simulationId?.trim() ? simulationId.trim() : null,
      proposalId: proposalId?.trim() ? proposalId.trim() : null,
      closedAt: closedAt ? toIsoString(closedAt) : null,
      calculationSnapshot: snapshot,
      metadata,
    };

    await onSubmit?.(payload);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="flex h-full max-h-full w-full flex-col sm:max-w-lg">
        <DrawerHeader className="border-b border-border/60 pb-4">
          <DrawerTitle>Registrar negócio</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-4">
            {normalizedAlertsActive ? (
              <div className="space-y-2">
                {normalizedAlerts.map((alert) => (
                  <Alert
                    key={`${alert.reason ?? 'missing'}-${alert.instanceId ?? alert.index}`}
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
                        <p className="text-xs uppercase tracking-wide text-amber-700/70">Código: {alert.reason}</p>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deal-stage">Estágio</Label>
                <Select
                  value={stage}
                  onValueChange={setStage}
                  disabled={fieldsDisabled}
                >
                  <SelectTrigger id="deal-stage">
                    <SelectValue placeholder="Sem mudança" />
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
            </div>

            <div className="space-y-4 rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/60 p-4">
              <h3 className="text-sm font-semibold text-foreground">Resumo financeiro</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deal-bank">Banco</Label>
                  {errors.bank ? <p className="text-xs text-rose-400">{errors.bank}</p> : null}
                  <Input
                    id="deal-bank"
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                    placeholder="Banco aprovado"
                    disabled={fieldsDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-product">Produto</Label>
                  <Input id="deal-product" value={productLabel} readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-installment">Parcela</Label>
                  {errors.installment ? <p className="text-xs text-rose-400">{errors.installment}</p> : null}
                  <Input
                    id="deal-installment"
                    value={installment}
                    onChange={(event) => setInstallment(event.target.value)}
                    placeholder="R$ 0,00"
                    disabled={fieldsDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-net">Valor líquido</Label>
                  {errors.netAmount ? <p className="text-xs text-rose-400">{errors.netAmount}</p> : null}
                  <Input
                    id="deal-net"
                    value={netAmount}
                    onChange={(event) => setNetAmount(event.target.value)}
                    placeholder="R$ 0,00"
                    disabled={fieldsDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-total">Valor contratado</Label>
                  <Input
                    id="deal-total"
                    value={totalAmount}
                    onChange={(event) => setTotalAmount(event.target.value)}
                    placeholder="R$ 0,00"
                    disabled={fieldsDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-term">Prazo (meses)</Label>
                  {errors.term ? <p className="text-xs text-rose-400">{errors.term}</p> : null}
                  <Input
                    id="deal-term"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="72"
                    disabled={fieldsDisabled}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deal-closedAt">Data de fechamento</Label>
              {errors.closedAt ? <p className="text-xs text-rose-400">{errors.closedAt}</p> : null}
              <Input
                id="deal-closedAt"
                type="date"
                value={closedAt}
                onChange={(event) => setClosedAt(event.target.value)}
                disabled={fieldsDisabled}
              />
            </div>

            <details className="group rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet/60 px-4 py-3 text-sm text-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                Ver detalhes avançados
              </summary>
              <div className="mt-3 space-y-3 text-xs">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-foreground-muted">Snapshot gerado</p>
                  <pre className="mt-1 max-h-56 overflow-auto rounded-md bg-surface-overlay-quiet px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground-muted">
{snapshotPreview}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-foreground-muted">Metadata (opcional)</p>
                  {errors.metadata ? <p className="text-[11px] text-rose-400">{errors.metadata}</p> : null}
                  <Textarea
                    className="mt-1 font-mono text-xs"
                    value={metadataText}
                    onChange={(event) => setMetadataText(event.target.value)}
                    placeholder="{\n  \"origin\": \"crm\"\n}"
                    minRows={4}
                    disabled={fieldsDisabled}
                  />
                </div>
              </div>
            </details>
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
