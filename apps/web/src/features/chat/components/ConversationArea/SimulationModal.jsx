import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import useConvenioCatalog from '@/features/agreements/useConvenioCatalog.ts';
import { findActiveWindow, getActiveRates } from '@/features/agreements/agreementsSelectors.ts';
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
import { createProposalMessageFromEntries } from './utils/proposalMessage.js';
import emitInboxTelemetry from '../../utils/telemetry.js';
import { useClipboard } from '@/hooks/use-clipboard.js';
import SimulationForm from './SimulationForm.jsx';
import QueueAlerts from './QueueAlerts.jsx';
import {
  NO_STAGE_VALUE,
  ensureUniqueTerms,
  formatDateInput,
  formatJson,
  normalizeStageState,
  parseDateInput,
  resolveStageValue,
} from '@/features/chat/utils/simulation.js';
import {
  SELECTION_ACTIONS,
  QUEUE_ALERTS_ACTIONS,
  createSelectionFallback,
  queueAlertsReducer,
  selectionReducer,
} from './utils/simulationReducers.js';

const DEFAULT_BASE_VALUE = '350';
const DEFAULT_SELECTED_TERMS = [72, 84];
const DEFAULT_TERM_POOL = [12, 24, 36, 48, 60, 72, 84];

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
  const isProposalMode = mode === 'proposal';
  const { convenios, agreementOptions, productsByAgreement } = useConvenioCatalog();
  const ticketId = defaultValues?.ticketId ?? null;
  const clipboard = useClipboard();

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
  const [selection, dispatchSelection] = useReducer(selectionReducer, []);
  const [normalizedAlerts, dispatchQueueAlerts] = useReducer(queueAlertsReducer, []);
  const [errors, setErrors] = useState({});

  const alertsActive = normalizedAlerts.length > 0;
  const fieldsDisabled = disabled || alertsActive;
  const hasAgreementOptions = agreementOptions.length > 0;

  useEffect(() => {
    dispatchQueueAlerts({
      type: QUEUE_ALERTS_ACTIONS.SYNC,
      payload: {
        alerts: queueAlerts,
        fallbackMessage: 'Fila padrão indisponível para registrar operações de vendas.',
      },
    });
  }, [queueAlerts]);

  const handleConvenioChange = (value) => {
    setConvenioId(value);
    const option = agreementOptions.find((item) => item.value === value);
    setConvenioLabel(option?.label ?? '');
    setProductId('');
    setProductLabel('');
  };

  // Auto-seleciona convênio/produto únicos ou default válido
  useEffect(() => {
    if (!open) {
      return;
    }

    if (!convenioId && agreementOptions.length === 1) {
      handleConvenioChange(agreementOptions[0].value);
    }
  }, [agreementOptions, convenioId, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const options = productsByAgreement.get(convenioId) ?? [];
    if (!productId && options.length === 1) {
      handleProductChange(options[0].value);
    }
  }, [convenioId, open, productId, productsByAgreement]);

  const handleProductChange = (value) => {
    setProductId(value);
    const option = (productsByAgreement.get(convenioId) ?? []).find(
      (item) => item.value === value,
    );
    setProductLabel(option?.label ?? '');
  };

  const selectedConvenio = useMemo(
    () => convenios.find((item) => item.id === convenioId) ?? null,
    [convenios, convenioId],
  );

  const productOptions = useMemo(() => {
    const optionsFromAgreements = productsByAgreement.get(convenioId);
    if (optionsFromAgreements && optionsFromAgreements.length > 0) {
      return optionsFromAgreements;
    }

    if (!selectedConvenio) {
      return [];
    }

    return (selectedConvenio.produtos ?? []).map((produto) => ({ value: produto, label: produto }));
  }, [convenioId, productsByAgreement, selectedConvenio]);

  const simulationDate = useMemo(() => parseDateInput(simulationDateInput) ?? new Date(), [simulationDateInput]);

  const activeWindow = useMemo(
    () => findActiveWindow(selectedConvenio, simulationDate),
    [selectedConvenio, simulationDate]
  );

  const activeTaxes = useMemo(
    () => getActiveRates(selectedConvenio, productId, simulationDate),
    [productId, selectedConvenio, simulationDate]
  );

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

  const visibleOffers = useMemo(() => {
    if (displayOffers.length === 0) {
      return [];
    }

    const sorted = [...displayOffers].sort((a, b) => {
      const rankAValue = Number(a?.rank);
      const rankBValue = Number(b?.rank);
      const rankA = Number.isFinite(rankAValue) ? rankAValue : Number.MAX_SAFE_INTEGER;
      const rankB = Number.isFinite(rankBValue) ? rankBValue : Number.MAX_SAFE_INTEGER;
      if (rankA === rankB) {
        const bankA = typeof a?.bankName === 'string' ? a.bankName : '';
        const bankB = typeof b?.bankName === 'string' ? b.bankName : '';
        return bankA.localeCompare(bankB);
      }
      return rankA - rankB;
    });

    return sorted.slice(0, 3);
  }, [displayOffers]);

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
      visibleOffers.map((offer) => ({
        ...offer,
        terms: offer.terms.map((term) => ({
          ...term,
          selected: selectionSet.has(`${offer.id}::${term.id}`),
        })),
      })),
    [selectionSet, visibleOffers],
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

    return createProposalMessageFromEntries(proposalSummary.selected);
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
      dispatchSelection({ type: SELECTION_ACTIONS.RESET, payload: proposalSelection });
    } else {
      dispatchSelection({
        type: SELECTION_ACTIONS.RESET,
        payload: createProposalSelection(baseSnapshot.offers ?? []),
      });
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

    const convenioOption = agreementOptions.find((option) => option.value === convenioId);
    const selectedConvenioLabel = selectedConvenio?.nome ?? '';
    const nextConvenioLabel = convenioOption?.label ?? selectedConvenioLabel;
    if (convenioLabel !== nextConvenioLabel) {
      setConvenioLabel(nextConvenioLabel);
    }

    if (!convenioId || (!convenioOption && !selectedConvenio)) {
      if (productId !== '') {
        setProductId('');
      }
      if (productLabel !== '') {
        setProductLabel('');
      }
      return;
    }

    const catalogProductOptions = productsByAgreement.get(convenioId);
    const catalogHasOptions = Array.isArray(catalogProductOptions) && catalogProductOptions.length > 0;

    if (productOptions.length === 0) {
      return;
    }

    const productOption = productOptions.find((option) => option.value === productId);
    if (!productOption) {
      if (!catalogHasOptions) {
        return;
      }

      const fallback = catalogProductOptions[0];
      const fallbackValue = fallback?.value ?? '';
      const fallbackLabel = fallback?.label ?? '';
      if (productId !== fallbackValue) {
        setProductId(fallbackValue);
      }
      if (productLabel !== fallbackLabel) {
        setProductLabel(fallbackLabel);
      }
      return;
    }

    if (productLabel !== productOption.label) {
      setProductLabel(productOption.label);
    }
  }, [
    agreementOptions,
    convenioId,
    convenioLabel,
    open,
    productId,
    productLabel,
    productOptions,
    productsByAgreement,
    selectedConvenio,
  ]);

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
      visibleOffers.flatMap((offer) => offer.terms.map((term) => `${offer.id}::${term.id}`)),
    );

    dispatchSelection({
      type: SELECTION_ACTIONS.SYNC_WITH_OFFERS,
      payload: {
        validKeys,
        fallbackSelection: createSelectionFallback(visibleOffers),
      },
    });
  }, [open, visibleOffers]);

  const handleToggleOfferSelection = (offerId, termId, checked) => {
    dispatchSelection({
      type: SELECTION_ACTIONS.TOGGLE,
      payload: { offerId, termId, checked },
    });
  };

  const handleTermOptionToggle = useCallback((term, checked) => {
    setSelectedTerms((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(term);
      } else {
        next.delete(term);
      }
      return ensureUniqueTerms(Array.from(next));
    });
  }, []);

  const handleAddCustomTerm = () => {
    const parsed = Number.parseInt(customTermInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    setSelectedTerms((current) => ensureUniqueTerms([...current, parsed]));
    setCustomTermInput('');
  };

  const handleCopyMessage = useCallback(() => {
    if (!proposalMessage) {
      return;
    }

    Promise.resolve(clipboard.copy(proposalMessage))
      .then((copied) => {
        emitInboxTelemetry('chat.sales.proposal.copy_message', {
          ticketId,
          source: 'simulation-modal',
          copied: Boolean(copied),
          length: proposalMessage.length,
        });
      })
      .catch(() => {
        emitInboxTelemetry('chat.sales.proposal.copy_message', {
          ticketId,
          source: 'simulation-modal',
          copied: false,
          length: proposalMessage.length,
        });
      });
  }, [clipboard, proposalMessage, ticketId]);
  const validateForm = () => {
    const nextErrors = {};

    const trimmedConvenioId = normalizeString(convenioId);
    const trimmedProductId = normalizeString(productId);
    const availableProducts = productsByAgreement.get(trimmedConvenioId) ?? [];

    if (!trimmedConvenioId) {
      nextErrors.convenio = hasAgreementOptions
        ? 'Selecione um convênio.'
        : 'Nenhum convênio disponível no momento. Configure um convênio para continuar.';
    }

    if (!trimmedProductId) {
      if (!trimmedConvenioId) {
        nextErrors.product = 'Selecione um convênio para listar os produtos disponíveis.';
      } else if (availableProducts.length === 0) {
        nextErrors.product = 'Este convênio não possui produtos configurados.';
      } else {
        nextErrors.product = 'Selecione um produto.';
      }
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
      toast.error('Preencha os campos obrigatórios para registrar a simulação.');
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

    const trimmedConvenioId = normalizeString(convenioId);
    const trimmedProductId = normalizeString(productId);
    const agreementOption = agreementOptions.find((option) => option.value === trimmedConvenioId);
    const productOption = (productsByAgreement.get(trimmedConvenioId) ?? []).find(
      (option) => option.value === trimmedProductId,
    );
    const effectiveConvenioLabel = agreementOption?.label || convenioLabel || trimmedConvenioId;
    const effectiveProductLabel = productOption?.label || productLabel || trimmedProductId;

    const simulationSnapshot = buildSimulationSnapshot({
      convenio: { id: trimmedConvenioId, label: effectiveConvenioLabel },
      product: { id: trimmedProductId, label: effectiveProductLabel },
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

  const hasBlockingIssues = calculationIssues.length > 0 || !ensureSelectionHasItems(selection);
  const submitDisabled = fieldsDisabled || isSubmitting || hasBlockingIssues;

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

        <QueueAlerts alerts={normalizedAlerts} disabledReason={disabledReason} />

        <SimulationForm
          errors={errors}
          convenioId={convenioId}
          onConvenioChange={handleConvenioChange}
          agreementOptions={agreementOptions}
          hasAgreementOptions={hasAgreementOptions}
          fieldsDisabled={fieldsDisabled}
          productId={productId}
          onProductChange={handleProductChange}
          productOptions={productOptions}
          simulationDateInput={simulationDateInput}
          onSimulationDateChange={(event) => setSimulationDateInput(event.target.value)}
          calculationMode={calculationMode}
          onCalculationModeChange={setCalculationMode}
          baseValueInput={baseValueInput}
          onBaseValueInputChange={(event) => setBaseValueInput(event.target.value)}
          availableTermOptions={availableTermOptions}
          selectedTerms={selectedTermsSorted}
          onToggleTerm={handleTermOptionToggle}
          customTermInput={customTermInput}
          onCustomTermInputChange={setCustomTermInput}
          onAddCustomTerm={handleAddCustomTerm}
          calculationIssues={calculationIssues}
          stage={stage}
          stageOptions={stageOptions}
          onStageChange={setStage}
          leadId={leadId}
          onLeadIdChange={(event) => setLeadId(event.target.value)}
          simulationId={simulationId}
          onSimulationIdChange={(event) => setSimulationId(event.target.value)}
          metadataText={metadataText}
          onMetadataChange={(event) => setMetadataText(event.target.value)}
        />

        <div className="mt-6 space-y-6">
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
              <div className="grid gap-4 lg:grid-cols-3">
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
                                  handleToggleOfferSelection(offer.id, term.id, Boolean(checked))
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
            <Label>Pré-visualização do payload</Label>
            <Textarea value={snapshotPreview} readOnly className="font-mono text-xs" rows={10} />
          </div>

          {isProposalMode ? (
            <div className="rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/60 p-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Mensagem para WhatsApp</h3>
                <p className="text-xs text-foreground-muted">
                  Use o resumo para copiar e enviar as condições selecionadas.
                </p>
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
          <Button type="button" onClick={handleSubmit} disabled={submitDisabled}>
            {isProposalMode ? 'Gerar proposta' : 'Registrar simulação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SimulationModal;
