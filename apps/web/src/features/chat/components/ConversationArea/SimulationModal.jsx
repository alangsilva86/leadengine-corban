import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
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
import useConvenioCatalog from '@/features/agreements/useConvenioCatalog.ts';
import { findActiveWindow, getActiveRates, normalizeString } from '@/features/agreements/agreementsSelectors.ts';
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
import SimulationForm from './SimulationForm.jsx';
import QueueAlerts from './QueueAlerts.jsx';
import {
  NO_STAGE_VALUE,
  ensureUniqueTerms,
  formatDateInput,
  formatJson,
  normalizeStageState,
  parseDateInput,
  parseMetadataText,
  resolveStageValue,
} from '@/features/chat/utils/simulation.js';
import { QUEUE_ALERTS_ACTIONS, queueAlertsReducer } from './utils/simulationReducers.js';
import useSimulationCalculation from './hooks/useSimulationCalculation.js';
import useProposalSelection from './hooks/useProposalSelection.js';
import SimulationOfferList, { TABLE_FILTER_ALL } from './SimulationOfferList.jsx';

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
  const {
    convenios: rawConvenios,
    agreementOptions: rawAgreementOptions,
    productsByAgreement: rawProductsByAgreement,
  } = useConvenioCatalog();
  const convenios = Array.isArray(rawConvenios) ? rawConvenios : [];
  const agreementOptions = Array.isArray(rawAgreementOptions) ? rawAgreementOptions : [];
  const productsByAgreement =
    rawProductsByAgreement instanceof Map ? rawProductsByAgreement : new Map();
  const ticketId = defaultValues?.ticketId ?? null;

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
  const [initialSelection, setInitialSelection] = useState([]);
  const [normalizedAlerts, dispatchQueueAlerts] = useReducer(queueAlertsReducer, []);
  const [errors, setErrors] = useState({});
  const [tableFilter, setTableFilter] = useState(TABLE_FILTER_ALL);

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

  const tableOptions = useMemo(() => {
    const unique = new Map();
    activeTaxes.forEach((tax, index) => {
      const tableId =
        normalizeString(tax?.table?.id) ||
        normalizeString(tax?.table?.name) ||
        normalizeString(tax?.modalidade);
      if (!tableId || unique.has(tableId)) {
        return;
      }
      const fallbackLabel = `Tabela ${index + 1}`;
      const label =
        normalizeString(tax?.table?.name) || normalizeString(tax?.modalidade) || fallbackLabel;
      unique.set(tableId, { value: tableId, label: label || fallbackLabel });
    });
    return Array.from(unique.values());
  }, [activeTaxes]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (tableOptions.length === 0) {
      if (tableFilter !== TABLE_FILTER_ALL) {
        setTableFilter(TABLE_FILTER_ALL);
      }
      return;
    }
    const hasSelected = tableOptions.some((option) => option.value === tableFilter);
    if (!hasSelected) {
      const fallbackValue = tableOptions.length === 1 ? tableOptions[0].value : TABLE_FILTER_ALL;
      if (tableFilter !== fallbackValue) {
        setTableFilter(fallbackValue);
      }
    }
  }, [open, tableFilter, tableOptions]);

  const filteredActiveTaxes = useMemo(() => {
    if (!tableFilter || tableFilter === TABLE_FILTER_ALL) {
      return activeTaxes;
    }
    const normalizedFilter = normalizeString(tableFilter);
    if (!normalizedFilter) {
      return activeTaxes;
    }
    return activeTaxes.filter((tax) => {
      const tableId =
        normalizeString(tax?.table?.id) ||
        normalizeString(tax?.table?.name) ||
        normalizeString(tax?.modalidade);
      return tableId === normalizedFilter;
    });
  }, [activeTaxes, tableFilter]);

  const availableTermOptions = useMemo(() => {
    const terms = new Set();
    filteredActiveTaxes.forEach((tax) => {
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
  }, [filteredActiveTaxes]);

  const selectedTermsSorted = useMemo(() => ensureUniqueTerms(selectedTerms), [selectedTerms]);

  const baseValueNumber = useMemo(() => {
    const parsed = Number.parseFloat(baseValueInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [baseValueInput]);

  const { calculationEnabled, calculationResult, visibleOffers, currentParameters } = useSimulationCalculation({
    convenio: selectedConvenio,
    productId,
    selectedTerms: selectedTermsSorted,
    baseValue: baseValueNumber,
    calculationMode,
    simulationDate,
    simulationDateInput,
    activeWindow,
    activeTaxes: filteredActiveTaxes,
    prefilledSnapshot,
  });

  const { selection, handleToggleOfferSelection } = useProposalSelection({
    open,
    visibleOffers,
    initialSelection,
  });

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
      setInitialSelection(proposalSelection);
    } else {
      setInitialSelection(createProposalSelection(baseSnapshot.offers ?? []));
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
    setTableFilter('');
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

    const { error: metadataError } = parseMetadataText(metadataText);
    if (metadataError) {
      nextErrors.metadata = metadataError;
    }

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

    const { parsed: metadata } = parseMetadataText(metadataText);

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

  const { blockingIssues, warningIssues } = useMemo(() => {
    const blocking = [];
    const warnings = [];

    if (!selectedConvenio) {
      blocking.push('Selecione um convênio para carregar as tabelas.');
    }
    if (selectedConvenio && !activeWindow) {
      blocking.push('Nenhuma janela vigente para a data escolhida. Atualize o calendário antes de simular.');
    }
    if (selectedConvenio && productId && filteredActiveTaxes.length === 0) {
      blocking.push('Nenhuma taxa válida para este produto na tabela ou data selecionada. Confira as configurações.');
    }
    if (selectedTermsSorted.length === 0) {
      blocking.push('Escolha ao menos um prazo para calcular as condições.');
    }
    if (baseValueNumber === null) {
      blocking.push(
        calculationMode === 'margin'
          ? 'Informe a margem disponível para gerar as condições.'
          : 'Informe o valor líquido desejado para calcular a margem.',
      );
    }
    if (calculationResult.issues.length > 0) {
      calculationResult.issues.forEach((issue) => {
        const formatted = issue.context ? `${issue.context}: ${issue.message}` : issue.message;
        if (issue.severity === 'warning') {
          warnings.push(formatted);
        } else {
          blocking.push(formatted);
        }
      });
    }
    return { blockingIssues: blocking, warningIssues: warnings };
  }, [
    filteredActiveTaxes.length,
    activeWindow,
    baseValueNumber,
    calculationMode,
    calculationResult.issues,
    productId,
    selectedConvenio,
    selectedTermsSorted.length,
  ]);

  const hasBlockingIssues = blockingIssues.length > 0 || !ensureSelectionHasItems(selection);
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
          blockingIssues={blockingIssues}
          warningIssues={warningIssues}
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
          <SimulationOfferList
            offers={resolvedOffers}
            currentParameters={currentParameters}
            fieldsDisabled={fieldsDisabled}
            errors={errors}
            onToggleOfferSelection={handleToggleOfferSelection}
            tableOptions={tableOptions}
            tableFilter={tableFilter}
            onTableFilterChange={setTableFilter}
          />

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
