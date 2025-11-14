import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Copy, Plus } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.jsx';
import { useClipboard } from '@/hooks/use-clipboard.js';
import useConvenioCatalog from '@/features/agreements/useConvenioCatalog.js';
import { simulateConvenioDeal, formatCurrency } from '@/features/agreements/utils/dailyCoefficient.js';
import {
  buildProposalSnapshot,
  buildSimulationSnapshot,
  createDefaultSimulationForm,
  createProposalSelection,
  ensureSelectionHasItems,
  formatTermLabel,
  normalizeProposalSnapshot,
  normalizeSimulationSnapshot,
  summarizeProposal,
} from './utils/salesSnapshot.js';

const NO_STAGE_VALUE = '__none__';
const DEFAULT_BASE_VALUE = '350';
const DEFAULT_SELECTED_TERMS = [72, 84];
const DEFAULT_TERM_POOL = [12, 24, 36, 48, 60, 72, 84];

const CALCULATION_MODE_OPTIONS = [
  {
    value: 'margin',
    label: 'Margem disponível',
    description: 'Informe a parcela/margem mensal disponível do cliente.',
  },
  {
    value: 'net',
    label: 'Valor líquido desejado',
    description: 'Calcular automaticamente a margem necessária para liberar um líquido.',
  },
];

const formatJson = (value) => {
  if (!value || typeof value !== 'object') {
    return '';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
};

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

const formatDateInput = (date) => {
  const safe = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = safe.getFullYear();
  const month = String(safe.getMonth() + 1).padStart(2, '0');
  const day = String(safe.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const ensureUniqueTerms = (terms) =>
  Array.from(new Set((Array.isArray(terms) ? terms : []).filter((term) => Number.isFinite(term)))).sort(
    (a, b) => a - b,
  );

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
          index,
        };
      })
      .slice(0, 3);
  }, [queueAlerts]);

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
  const clipboard = useClipboard();
  const stageTriggerRef = useRef(null);
  const isProposalMode = mode === 'proposal';
  const { convenios } = useConvenioCatalog();

  const [stage, setStage] = useState(() => normalizeStageState(defaultValues.stage));
  const [leadId, setLeadId] = useState(defaultValues.leadId ?? '');
  const [simulationId, setSimulationId] = useState(defaultValues.simulationId ?? '');
  const [metadataText, setMetadataText] = useState(formatJson(defaultValues.metadata));
  const [convenioId, setConvenioId] = useState('');
  const [productId, setProductId] = useState('');
  const [convenioLabel, setConvenioLabel] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [calculationMode, setCalculationMode] = useState('margin');
  const [baseValueInput, setBaseValueInput] = useState(DEFAULT_BASE_VALUE);
  const [simulationDateInput, setSimulationDateInput] = useState(formatDateInput(new Date()));
  const [selectedTerms, setSelectedTerms] = useState(DEFAULT_SELECTED_TERMS);
  const [customTermInput, setCustomTermInput] = useState('');
  const [prefilledSnapshot, setPrefilledSnapshot] = useState(() => ({
    offers: createDefaultSimulationForm().offers,
    parameters: null,
  }));
  const [selection, setSelection] = useState([]);
  const [errors, setErrors] = useState({});

  const normalizedAlerts = useQueueAlerts(queueAlerts);
  const alertsActive = normalizedAlerts.length > 0;
  const fieldsDisabled = disabled || alertsActive;

  const selectedConvenio = useMemo(
    () => convenios.find((item) => item.id === convenioId) ?? null,
    [convenios, convenioId],
  );

  const productOptions = useMemo(() => {
    if (!selectedConvenio) {
      return [];
    }
    return (selectedConvenio.produtos ?? []).map((produto) => ({ value: produto, label: produto }));
  }, [selectedConvenio]);

  const simulationDate = useMemo(() => parseDateInput(simulationDateInput) ?? new Date(), [simulationDateInput]);

  const activeWindow = useMemo(() => {
    if (!selectedConvenio) {
      return null;
    }
    return (
      selectedConvenio.janelas ?? []
    ).find((window) =>
      window.start instanceof Date &&
      window.end instanceof Date &&
      simulationDate >= window.start &&
      simulationDate <= window.end,
    ) ?? null;
  }, [selectedConvenio, simulationDate]);

  const activeTaxes = useMemo(() => {
    if (!selectedConvenio || !productId) {
      return [];
    }
    return (selectedConvenio.taxas ?? []).filter((tax) => {
      if (tax.produto !== productId) {
        return false;
      }
      if (typeof tax.status === 'string' && tax.status.toLowerCase() !== 'ativa') {
        return false;
      }
      if (tax.validFrom instanceof Date && simulationDate < tax.validFrom) {
        return false;
      }
      if (tax.validUntil instanceof Date && simulationDate > tax.validUntil) {
        return false;
      }
      return true;
    });
  }, [productId, selectedConvenio, simulationDate]);

  const availableTermOptions = useMemo(() => {
    const terms = new Set();
    activeTaxes.forEach((tax) => {
      (tax.termOptions ?? []).forEach((term) => {
        if (Number.isFinite(term)) {
          terms.add(term);
        }
      });
    });
    if (terms.size === 0) {
      DEFAULT_TERM_POOL.forEach((term) => terms.add(term));
    }
    return Array.from(terms).sort((a, b) => a - b);
  }, [activeTaxes]);

  const selectedTermsSorted = useMemo(() => ensureUniqueTerms(selectedTerms), [selectedTerms]);

  const baseValueNumber = useMemo(() => {
    const parsed = Number.parseFloat(baseValueInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [baseValueInput]);

  const calculationEnabled =
    Boolean(selectedConvenio) &&
    Boolean(productId) &&
    Boolean(activeWindow) &&
    activeTaxes.length > 0 &&
    selectedTermsSorted.length > 0 &&
    baseValueNumber !== null;
  const calculationResult = useMemo(() => {
    if (!calculationEnabled) {
      return { offers: [], parameters: null, issues: [] };
    }

    const issues = [];
    const termList = selectedTermsSorted;
    const offers = activeTaxes
      .map((tax, index) => {
        const offerId = tax.id ?? `offer-${index + 1}`;
        const bankName = tax.bank?.name ?? `Banco ${index + 1}`;
        const tableName = tax.table?.name ?? tax.modalidade ?? '';

        const terms = termList
          .map((term) => {
            try {
              const simulation = simulateConvenioDeal({
                margem: calculationMode === 'margin' ? baseValueNumber : undefined,
                targetNetAmount: calculationMode === 'net' ? baseValueNumber : undefined,
                prazoMeses: term,
                dataSimulacao: simulationDate,
                janela: activeWindow,
                taxa: tax,
              });

              return {
                id: `${offerId}-${term}`,
                term,
                installment: simulation.installment,
                netAmount: simulation.netAmount,
                totalAmount: simulation.grossAmount,
                coefficient: simulation.coefficient,
                tacValue: simulation.tacValue,
                source: 'auto',
                calculation: {
                  baseType: calculationMode,
                  baseValue: baseValueNumber,
                  simulationDate: simulationDateInput,
                  windowId: activeWindow?.id ?? null,
                  windowLabel: activeWindow?.label ?? null,
                  taxId: tax.id ?? null,
                  modality: tax.modalidade ?? null,
                  product: tax.produto ?? null,
                  monthlyRate: simulation.details.monthlyRate,
                  dailyRate: simulation.details.dailyRate,
                  graceDays: simulation.details.graceDays,
                  presentValueUnit: simulation.details.presentValueUnit,
                  tacPercent: simulation.details.tacPercent,
                  tacFlat: simulation.details.tacFlat,
                },
                metadata: {
                  bankId: tax.bank?.id ?? null,
                  tableId: tax.table?.id ?? null,
                },
              };
            } catch (error) {
              issues.push({
                type: 'error',
                message: error instanceof Error ? error.message : 'Falha ao calcular condição.',
                context: `${bankName} • ${term} meses`,
              });
              return null;
            }
          })
          .filter(Boolean);

        if (terms.length === 0) {
          return null;
        }

        return {
          id: offerId,
          bankId: tax.bank?.id ?? `bank-${index + 1}`,
          bankName,
          table: tableName,
          tableId: tax.table?.id ?? '',
          taxId: tax.id ?? '',
          modality: tax.modalidade ?? '',
          rank: index + 1,
          source: 'auto',
          metadata: {
            produto: tax.produto ?? null,
          },
          terms,
        };
      })
      .filter(Boolean);

    const parameters = {
      baseType: calculationMode,
      baseValue: baseValueNumber,
      simulationDate: simulationDateInput,
      windowId: activeWindow?.id ?? null,
      windowLabel: activeWindow?.label ?? null,
      termOptions: termList,
      taxIds: activeTaxes.map((tax) => tax.id).filter(Boolean),
    };

    return { offers, parameters, issues };
  }, [
    activeTaxes,
    activeWindow,
    baseValueNumber,
    calculationEnabled,
    calculationMode,
    simulationDate,
    simulationDateInput,
    selectedTermsSorted,
  ]);

  const displayOffers = useMemo(() => {
    if (calculationResult.offers.length > 0) {
      return calculationResult.offers;
    }
    return prefilledSnapshot.offers ?? [];
  }, [calculationResult.offers, prefilledSnapshot.offers]);

  const currentParameters = useMemo(() => {
    if (calculationResult.parameters) {
      return calculationResult.parameters;
    }
    return prefilledSnapshot.parameters ?? null;
  }, [calculationResult.parameters, prefilledSnapshot.parameters]);

  const selectionSet = useMemo(
    () => new Set(selection.map((entry) => `${entry.offerId}::${entry.termId}`)),
    [selection],
  );

  const resolvedOffers = useMemo(
    () =>
      displayOffers.map((offer) => ({
        ...offer,
        terms: offer.terms.map((term) => ({
          ...term,
          selected: selectionSet.has(`${offer.id}::${term.id}`),
        })),
      })),
    [displayOffers, selectionSet],
  );
  const proposalSummary = useMemo(() => {
    if (!isProposalMode) {
      return null;
    }

    const simulationSnapshot = buildSimulationSnapshot({
      convenio: { id: convenioId, label: convenioLabel },
      product: { id: productId, label: productLabel },
      offers: resolvedOffers,
      parameters: currentParameters,
    });

    const proposalSnapshot = buildProposalSnapshot({
      simulation: {
        ...simulationSnapshot,
        simulationId,
      },
      selectedOffers: selection,
      message: '',
      pdf: {},
    });

    return summarizeProposal(proposalSnapshot);
  }, [convenioId, convenioLabel, currentParameters, isProposalMode, productId, productLabel, resolvedOffers, selection, simulationId]);

  const proposalMessage = useMemo(() => {
    if (!isProposalMode || !proposalSummary) {
      return '';
    }

    if (!ensureSelectionHasItems(selection)) {
      return 'Selecione ao menos uma condição para montar a proposta.';
    }

    const lines = proposalSummary.selected.map((entry, index) => {
      const termLabel = formatTermLabel(entry.term.term);
      const installmentLabel = formatCurrency(entry.term.installment);
      const netLabel = formatCurrency(entry.term.netAmount);
      const tableLabel = entry.offer.table ? ` • ${entry.offer.table}` : '';
      return `${index + 1}) ${entry.bankName}${tableLabel} • ${termLabel} de ${installmentLabel} (líquido ${netLabel})`;
    });

    return ['Olá! Preparámos uma proposta com as melhores condições para você:', ...lines, 'Posso avançar com o contrato?'].join(
      '\n',
    );
  }, [isProposalMode, proposalSummary, selection]);

  const proposalFileName = useMemo(() => {
    if (!proposalSummary || proposalSummary.selected.length === 0) {
      return 'proposta.pdf';
    }

    const primary = proposalSummary.selected[0];
    const termLabel = formatTermLabel(primary.term.term, { fallback: 'prazo' }).replace('x', 'x');
    const bankSlug = primary.bankName
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    return `proposta-${bankSlug || 'banco'}-${termLabel}.pdf`;
  }, [proposalSummary]);

  const snapshotPreview = useMemo(() => {
    const snapshotBase = buildSimulationSnapshot({
      convenio: { id: convenioId, label: convenioLabel },
      product: { id: productId, label: productLabel },
      offers: resolvedOffers,
      parameters: currentParameters,
    });

    if (isProposalMode) {
      const proposalSnapshot = buildProposalSnapshot({
        simulation: {
          ...snapshotBase,
          simulationId,
        },
        selectedOffers: selection,
        message: '',
        pdf: {},
      });
      return formatJson(proposalSnapshot);
    }

    return formatJson(snapshotBase);
  }, [convenioId, convenioLabel, currentParameters, isProposalMode, productId, productLabel, resolvedOffers, selection, simulationId]);
  useEffect(() => {
    if (!open) {
      return;
    }

    const baseSnapshot = normalizeSimulationSnapshot(
      isProposalMode ? defaultValues.simulationSnapshot ?? defaultValues.calculationSnapshot : defaultValues.calculationSnapshot,
    ) ?? createDefaultSimulationForm();

    setPrefilledSnapshot({
      offers: baseSnapshot.offers ?? [],
      parameters: baseSnapshot.parameters ?? null,
    });

    if (isProposalMode) {
      const proposalSnapshot = normalizeProposalSnapshot(defaultValues.calculationSnapshot ?? null);
      const proposalSelection = createProposalSelection(proposalSnapshot?.offers ?? baseSnapshot.offers ?? []);
      setSelection(proposalSelection);
    } else {
      setSelection(createProposalSelection(baseSnapshot.offers ?? []));
    }

    const hasSnapshot = Boolean(defaultValues.calculationSnapshot);
    setStage(normalizeStageState(defaultValues.stage));
    setLeadId(defaultValues.leadId ?? '');
    setSimulationId(defaultValues.simulationId ?? '');
    setMetadataText(formatJson(defaultValues.metadata));
    setConvenioId(baseSnapshot.convenio?.id ?? '');
    setProductId(baseSnapshot.product?.id ?? '');
    setConvenioLabel(baseSnapshot.convenio?.label ?? '');
    setProductLabel(baseSnapshot.product?.label ?? '');

    const baseType = baseSnapshot.parameters?.baseType ?? 'margin';
    const baseValue = baseSnapshot.parameters?.baseValue;
    setCalculationMode(baseType || 'margin');
    setBaseValueInput(
      Number.isFinite(baseValue) && baseValue > 0
        ? String(baseValue)
        : hasSnapshot
          ? ''
          : DEFAULT_BASE_VALUE,
    );
    setSelectedTerms(
      baseSnapshot.parameters?.termOptions?.length
        ? ensureUniqueTerms(baseSnapshot.parameters.termOptions)
        : DEFAULT_SELECTED_TERMS,
    );
    const snapshotDate = baseSnapshot.parameters?.simulationDate
      ? parseDateInput(baseSnapshot.parameters.simulationDate)
      : null;
    setSimulationDateInput(formatDateInput(snapshotDate ?? new Date()));
    setErrors({});
  }, [defaultValues, isProposalMode, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const option = convenios.find((item) => item.id === convenioId);
    setConvenioLabel(option?.nome ?? '');
    if (!option) {
      setProductId('');
      setProductLabel('');
      return;
    }

    if (!option.produtos?.includes(productId)) {
      const fallback = option.produtos?.[0] ?? '';
      setProductId(fallback);
      setProductLabel(fallback ?? '');
      return;
    }

    setProductLabel(productId ?? '');
  }, [convenioId, convenios, open, productId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const available = new Set(availableTermOptions);
    setSelectedTerms((current) => {
      const valid = ensureUniqueTerms(current).filter((term) => available.has(term));
      if (valid.length > 0) {
        return valid;
      }
      const fallback = availableTermOptions[0];
      return typeof fallback === 'number' ? [fallback] : [];
    });
  }, [availableTermOptions, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const validKeys = new Set(
      displayOffers.flatMap((offer) => offer.terms.map((term) => `${offer.id}::${term.id}`)),
    );

    setSelection((prev) => {
      const filtered = prev.filter((entry) => validKeys.has(`${entry.offerId}::${entry.termId}`));
      if (filtered.length > 0) {
        return filtered;
      }
      if (displayOffers.length === 0) {
        return filtered;
      }
      return displayOffers.flatMap((offer) => {
        const primary = offer.terms[0];
        return primary ? [{ offerId: offer.id, termId: primary.id }] : [];
      });
    });
  }, [displayOffers, open]);

  const handleToggleTermSelection = (offerId, termId, checked) => {
    setSelection((prev) => {
      const exists = prev.some((entry) => entry.offerId === offerId && entry.termId === termId);
      if (checked && !exists) {
        return [...prev, { offerId, termId }];
      }
      if (!checked && exists) {
        return prev.filter((entry) => !(entry.offerId === offerId && entry.termId === termId));
      }
      return prev;
    });
  };

  const handleAddCustomTerm = () => {
    const parsed = Number.parseInt(customTermInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    setSelectedTerms((current) => ensureUniqueTerms([...current, parsed]));
    setCustomTermInput('');
  };

  const handleCopyMessage = () => {
    if (!proposalMessage) {
      return;
    }
    clipboard.copy(proposalMessage);
  };
  const validateForm = () => {
    const nextErrors = {};

    if (!convenioId) {
      nextErrors.convenio = 'Selecione um convênio.';
    }

    if (!productId) {
      nextErrors.product = 'Selecione um produto.';
    }

    if (!ensureSelectionHasItems(selection)) {
      nextErrors.selection = isProposalMode
        ? 'Selecione ao menos uma condição para enviar a proposta.'
        : 'Escolha ao menos uma condição para registrar a simulação.';
    }

    const metadataErrors = {};
    if (metadataText.trim().length > 0) {
      try {
        const parsed = JSON.parse(metadataText);
        if (!parsed || typeof parsed !== 'object') {
          metadataErrors.metadata = 'Metadata deve ser um JSON válido.';
        }
      } catch {
        metadataErrors.metadata = 'Metadata deve ser um JSON válido.';
      }
    }

    Object.assign(nextErrors, metadataErrors);

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
        // já validado anteriormente
      }
    }

    const simulationSnapshot = buildSimulationSnapshot({
      convenio: { id: convenioId, label: convenioLabel },
      product: { id: productId, label: productLabel },
      offers: resolvedOffers,
      parameters: currentParameters,
    });

    const payload = {
      stage: resolveStageValue(stage) || null,
      leadId: leadId?.trim() ? leadId.trim() : null,
      calculationSnapshot: simulationSnapshot,
      metadata,
    };

    if (isProposalMode) {
      payload.proposalSnapshot = buildProposalSnapshot({
        simulation: {
          ...simulationSnapshot,
          simulationId,
        },
        selectedOffers: selection,
        message: proposalMessage,
        pdf: { fileName: proposalFileName, status: 'pending' },
      });
    }

    await onSubmit?.(payload);
  };

  const calculationIssues = useMemo(() => {
    const issues = [];
    if (!selectedConvenio) {
      issues.push('Selecione um convênio para carregar as tabelas.');
    }
    if (selectedConvenio && !activeWindow) {
      issues.push('Nenhuma janela vigente para a data escolhida. Atualize o calendário antes de simular.');
    }
    if (selectedConvenio && productId && activeTaxes.length === 0) {
      issues.push('Nenhuma taxa válida para este produto nesta data. Confira as configurações.');
    }
    if (selectedTermsSorted.length === 0) {
      issues.push('Escolha ao menos um prazo para calcular as condições.');
    }
    if (baseValueNumber === null) {
      issues.push(
        calculationMode === 'margin'
          ? 'Informe a margem disponível para gerar as condições.'
          : 'Informe o valor líquido desejado para calcular a margem.',
      );
    }
    if (calculationResult.issues.length > 0) {
      calculationResult.issues.forEach((issue) => {
        issues.push(issue.context ? `${issue.context}: ${issue.message}` : issue.message);
      });
    }
    return issues;
  }, [activeTaxes.length, activeWindow, baseValueNumber, calculationMode, calculationResult.issues, productId, selectedConvenio, selectedTermsSorted.length]);

  const renderCalculationAlerts = () => {
    if (calculationIssues.length === 0) {
      return null;
    }
    return (
      <Alert variant="warning" className="border-amber-400/60 bg-amber-50 text-amber-900">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Não foi possível gerar todas as condições</AlertTitle>
        <AlertDescription>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
            {calculationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isProposalMode ? 'Montar proposta' : 'Registrar simulação'}</DialogTitle>
          <DialogDescription>
            {isProposalMode
              ? 'Selecione as melhores condições calculadas automaticamente para enviar a proposta ao cliente.'
              : 'Calcule condições a partir das tabelas do convênio. Os campos são preenchidos automaticamente.'}
          </DialogDescription>
        </DialogHeader>

        {alertsActive ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Fila padrão indisponível</AlertTitle>
            <AlertDescription>
              <p className="text-sm text-muted-foreground">{disabledReason}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {normalizedAlerts.map((alert) => (
                  <li key={alert.index}>
                    {alert.message}
                    {alert.instanceId ? (
                      <span className="text-muted-foreground"> — Instância afetada: {alert.instanceId}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-4 space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Convênio</Label>
              <Select value={convenioId} onValueChange={setConvenioId} disabled={fieldsDisabled}>
                <SelectTrigger ref={stageTriggerRef}>
                  <SelectValue placeholder="Selecione um convênio" />
                </SelectTrigger>
                <SelectContent>
                  {convenios.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.convenio ? <p className="text-sm text-destructive">{errors.convenio}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={productId} onValueChange={setProductId} disabled={fieldsDisabled || productOptions.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.product ? <p className="text-sm text-destructive">{errors.product}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Data da simulação</Label>
              <Input
                type="date"
                value={simulationDateInput}
                onChange={(event) => setSimulationDateInput(event.target.value)}
                disabled={fieldsDisabled}
              />
              <p className="text-xs text-muted-foreground">
                Usada para validar a janela vigente e a vigência das taxas configuradas.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Etapa (opcional)</Label>
              <Select value={stage} onValueChange={setStage} disabled={fieldsDisabled || stageOptions.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="__none__" value={NO_STAGE_VALUE}>
                    Sem alteração
                  </SelectItem>
                  {stageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lead (opcional)</Label>
              <Input
                value={leadId}
                onChange={(event) => setLeadId(event.target.value)}
                placeholder="Identificador do lead"
                disabled={fieldsDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Simulação (opcional)</Label>
              <Input
                value={simulationId}
                onChange={(event) => setSimulationId(event.target.value)}
                placeholder="Identificador da simulação"
                disabled={fieldsDisabled}
              />
            </div>
          </div>

          <div className="rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/60 p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Base de cálculo</Label>
                <RadioGroup
                  value={calculationMode}
                  onValueChange={setCalculationMode}
                  className="grid gap-2 sm:grid-cols-2"
                  disabled={fieldsDisabled}
                >
                  {CALCULATION_MODE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-sm"
                    >
                      <RadioGroupItem value={option.value} />
                      <div>
                        <p className="font-medium text-foreground">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>{calculationMode === 'margin' ? 'Margem disponível (R$)' : 'Valor líquido desejado (R$)'}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={baseValueInput}
                  onChange={(event) => setBaseValueInput(event.target.value)}
                  placeholder={calculationMode === 'margin' ? 'Ex.: 350' : 'Ex.: 5000'}
                  disabled={fieldsDisabled}
                />
                <p className="text-xs text-muted-foreground">
                  {calculationMode === 'margin'
                    ? 'Valor da parcela disponível para consignar.'
                    : 'Valor líquido que o cliente espera receber.'}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <Label>Prazos desejados</Label>
              <div className="flex flex-wrap gap-2">
                {availableTermOptions.map((term) => {
                  const checked = selectedTermsSorted.includes(term);
                  return (
                    <label
                      key={term}
                      className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          setSelectedTerms((current) => {
                            const next = new Set(current);
                            if (value) {
                              next.add(term);
                            } else {
                              next.delete(term);
                            }
                            return ensureUniqueTerms(Array.from(next));
                          })
                        }
                        disabled={fieldsDisabled}
                      />
                      {term} meses
                    </label>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={customTermInput}
                    onChange={(event) => setCustomTermInput(event.target.value)}
                    placeholder="Adicionar prazo manual"
                    disabled={fieldsDisabled}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomTerm}
                    disabled={fieldsDisabled || !customTermInput}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Combine prazos diferentes para comparar as tabelas dos bancos.
                </p>
              </div>
            </div>
            <div className="mt-4">{renderCalculationAlerts()}</div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Condições calculadas</h3>
              {currentParameters?.windowLabel ? (
                <Badge variant="outline" className="text-xs">
                  Janela {currentParameters.windowLabel}
                </Badge>
              ) : null}
            </div>
            {resolvedOffers.length === 0 ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                Configure convênio, produto e parâmetros para gerar as condições automaticamente.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {resolvedOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="flex flex-col gap-3 rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{offer.bankName}</p>
                        <p className="text-xs text-muted-foreground">
                          {offer.table || 'Tabela não informada'}
                          {offer.modality ? ` • ${offer.modality}` : ''}
                        </p>
                      </div>
                      {offer.source === 'auto' ? (
                        <Badge variant="outline" className="text-xs text-primary">
                          Automático
                        </Badge>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      {offer.terms.map((term) => (
                        <div
                          key={term.id}
                          className="rounded-lg border border-border/50 bg-background/70 p-3 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                              <Checkbox
                                id={`${offer.id}-term-${term.id}`}
                                checked={term.selected}
                                onCheckedChange={(checked) =>
                                  handleToggleTermSelection(offer.id, term.id, Boolean(checked))
                                }
                                disabled={fieldsDisabled}
                              />
                              {term.term} meses
                            </label>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              coef {term.coefficient?.toFixed(4) ?? '—'}
                            </Badge>
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-md bg-muted/60 p-2">
                              <dt className="text-muted-foreground">Parcela</dt>
                              <dd className="font-semibold text-foreground">{formatCurrency(term.installment ?? 0)}</dd>
                            </div>
                            <div className="rounded-md bg-muted/60 p-2">
                              <dt className="text-muted-foreground">Valor bruto</dt>
                              <dd className="font-semibold text-foreground">{formatCurrency(term.totalAmount ?? 0)}</dd>
                            </div>
                            <div className="rounded-md bg-muted/60 p-2">
                              <dt className="text-muted-foreground">Valor líquido</dt>
                              <dd className="font-semibold text-emerald-600">{formatCurrency(term.netAmount ?? 0)}</dd>
                            </div>
                            <div className="rounded-md bg-muted/60 p-2">
                              <dt className="text-muted-foreground">TAC</dt>
                              <dd className="font-semibold text-foreground">{formatCurrency(term.tacValue ?? 0)}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {errors.selection ? <p className="text-sm text-destructive">{errors.selection}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>Metadata (JSON opcional)</Label>
            <Textarea
              value={metadataText}
              onChange={(event) => setMetadataText(event.target.value)}
              placeholder="{ }"
              className="font-mono text-xs"
              rows={4}
              disabled={fieldsDisabled}
            />
            {errors.metadata ? <p className="text-sm text-destructive">{errors.metadata}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>Pré-visualização do payload</Label>
            <Textarea value={snapshotPreview} readOnly className="font-mono text-xs" rows={10} />
          </div>

          {isProposalMode ? (
            <div className="rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/60 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Mensagem para WhatsApp</h3>
                  <p className="text-xs text-foreground-muted">
                    Copie e envie diretamente para o cliente com as condições selecionadas.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleCopyMessage} disabled={!proposalMessage}>
                  <Copy className="mr-2 h-3.5 w-3.5" aria-hidden />
                  Copiar mensagem
                </Button>
              </div>
              <Textarea value={proposalMessage} readOnly rows={6} className="mt-3 text-sm" />
              <p className="mt-2 text-xs text-muted-foreground">Arquivo gerado: {proposalFileName}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Revisado automaticamente com base nas tabelas do convênio. Ajustes manuais ficam registrados no payload.
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting || fieldsDisabled}>
              {isProposalMode ? 'Enviar proposta' : 'Registrar simulação'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SimulationModal;
