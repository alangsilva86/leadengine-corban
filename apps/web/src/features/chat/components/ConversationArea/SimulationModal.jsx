import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Copy, Plus, Trash2 } from 'lucide-react';
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
import { useClipboard } from '@/hooks/use-clipboard.js';
import {
  buildProposalSnapshot,
  buildSimulationSnapshot,
  createDefaultSimulationForm,
  createProposalSelection,
  ensureSelectionHasItems,
  formatCurrency,
  formatTermLabel,
  normalizeProposalSnapshot,
  normalizeSimulationSnapshot,
  summarizeProposal,
} from './utils/salesSnapshot.js';

const NO_STAGE_VALUE = '__none__';

const CONVENIO_OPTIONS = [
  {
    value: 'inss',
    label: 'INSS',
    products: [
      { value: 'emprestimo', label: 'Empréstimo consignado' },
      { value: 'cartao_consignado', label: 'Cartão consignado' },
      { value: 'fgts', label: 'Antecipação FGTS' },
    ],
  },
  {
    value: 'siape',
    label: 'SIAPE',
    products: [
      { value: 'emprestimo', label: 'Empréstimo consignado' },
      { value: 'cartao_beneficio', label: 'Cartão benefício' },
    ],
  },
  {
    value: 'municipal',
    label: 'Prefeituras municipais',
    products: [
      { value: 'emprestimo', label: 'Empréstimo consignado' },
      { value: 'cartao_consignado', label: 'Cartão consignado' },
    ],
  },
  {
    value: 'estadual',
    label: 'Servidores estaduais',
    products: [
      { value: 'emprestimo', label: 'Empréstimo consignado' },
      { value: 'fgts', label: 'Antecipação FGTS' },
    ],
  },
];

const NO_PRODUCT_OPTION = { value: '', label: 'Selecione um produto' };

const resolveProductOptions = (convenioId) => {
  const convenio = CONVENIO_OPTIONS.find((option) => option.value === convenioId);
  if (!convenio) {
    return [];
  }
  return convenio.products ?? [];
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

const ensureOfferTerms = (offers) =>
  offers.map((offer) => ({
    ...offer,
    terms: offer.terms.length > 0 ? offer.terms : [{ id: `${offer.id}-term`, term: '', installment: '', netAmount: '', totalAmount: '', selected: false }],
  }));

const prepareSimulationForm = (snapshot) => {
  const normalized = normalizeSimulationSnapshot(snapshot) ?? createDefaultSimulationForm();
  const offers = ensureOfferTerms(normalized.offers).map((offer, index) => ({
    id: offer.id,
    bankId: offer.bankId ?? '',
    bankName: offer.bankName ?? `Banco ${index + 1}`,
    table: offer.table ?? '',
    rank: offer.rank ?? index + 1,
    terms: offer.terms.map((term, termIndex) => ({
      id: term.id ?? `${offer.id}-term-${termIndex + 1}`,
      term: term.term ? String(term.term) : '',
      installment: term.installment ? String(term.installment) : '',
      netAmount: term.netAmount ? String(term.netAmount) : '',
      totalAmount: term.totalAmount ? String(term.totalAmount) : '',
      selected: Boolean(term.selected),
    })),
  }));

  return {
    convenioId: normalized.convenio?.id ?? '',
    convenioLabel: normalized.convenio?.label ?? '',
    productId: normalized.product?.id ?? '',
    productLabel: normalized.product?.label ?? '',
    offers,
  };
};

const ensureMinimumOffers = (offers, minimum = 3) => {
  const result = [...offers];
  while (result.length < minimum) {
    result.push({
      id: `offer-${result.length + 1}`,
      bankId: '',
      bankName: '',
      table: '',
      rank: result.length + 1,
      terms: [
        {
          id: `offer-${result.length + 1}-term-1`,
          term: '',
          installment: '',
          netAmount: '',
          totalAmount: '',
          selected: false,
        },
      ],
    });
  }
  return result;
};

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

  const [stage, setStage] = useState(() => normalizeStageState(defaultValues.stage));
  const [leadId, setLeadId] = useState(defaultValues.leadId ?? '');
  const [simulationId, setSimulationId] = useState(defaultValues.simulationId ?? '');
  const [metadataText, setMetadataText] = useState(formatJson(defaultValues.metadata));
  const [offers, setOffers] = useState(() => ensureMinimumOffers(prepareSimulationForm(defaultValues.calculationSnapshot).offers));
  const [convenioId, setConvenioId] = useState('');
  const [productId, setProductId] = useState('');
  const [convenioLabel, setConvenioLabel] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [selection, setSelection] = useState(() => createProposalSelection(offers));
  const [errors, setErrors] = useState({});

  const normalizedAlerts = useQueueAlerts(queueAlerts);
  const alertsActive = normalizedAlerts.length > 0;
  const fieldsDisabled = disabled || alertsActive;

  useEffect(() => {
    if (!open) {
      return;
    }

    const baseValues = prepareSimulationForm(
      isProposalMode ? defaultValues.simulationSnapshot ?? defaultValues.calculationSnapshot : defaultValues.calculationSnapshot,
    );

    const hydratedOffers = ensureMinimumOffers(baseValues.offers);

    if (isProposalMode) {
      const proposalSnapshot = normalizeProposalSnapshot(defaultValues.calculationSnapshot ?? null);
      const proposalSelection = createProposalSelection(proposalSnapshot?.offers ?? hydratedOffers);
      setSelection(proposalSelection);
    } else {
      setSelection(createProposalSelection(hydratedOffers));
    }

    setStage(normalizeStageState(defaultValues.stage));
    setLeadId(defaultValues.leadId ?? '');
    setSimulationId(defaultValues.simulationId ?? '');
    setMetadataText(formatJson(defaultValues.metadata));
    setOffers(hydratedOffers);
    setConvenioId(baseValues.convenioId ?? '');
    setProductId(baseValues.productId ?? '');
    setConvenioLabel(baseValues.convenioLabel ?? '');
    setProductLabel(baseValues.productLabel ?? '');
    setErrors({});
  }, [defaultValues, isProposalMode, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const convenioOption = CONVENIO_OPTIONS.find((option) => option.value === convenioId);
    setConvenioLabel(convenioOption?.label ?? '');

    const productOption = resolveProductOptions(convenioId).find((option) => option.value === productId);
    setProductLabel(productOption?.label ?? '');
  }, [convenioId, open, productId]);

  const productOptions = useMemo(() => resolveProductOptions(convenioId), [convenioId]);

  const snapshotPreview = useMemo(() => {
    const snapshotBase = buildSimulationSnapshot({
      convenio: { id: convenioId, label: convenioLabel },
      product: { id: productId, label: productLabel },
      offers,
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
  }, [convenioId, convenioLabel, isProposalMode, offers, productId, productLabel, selection, simulationId]);

  const proposalSummary = useMemo(() => {
    if (!isProposalMode) {
      return null;
    }

    const simulationSnapshot = buildSimulationSnapshot({
      convenio: { id: convenioId, label: convenioLabel },
      product: { id: productId, label: productLabel },
      offers,
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
  }, [convenioId, convenioLabel, isProposalMode, offers, productId, productLabel, selection, simulationId]);

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
      return `${index + 1}) ${entry.bankName} • ${termLabel} de ${installmentLabel} (líquido ${netLabel})`;
    });

    return ['Olá! Preparámos uma proposta com as melhores condições para você:', ...lines, 'Posso avançar com o contrato?'].join('\n');
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

  const handleOfferChange = (index, field, value) => {
    setOffers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleTermChange = (offerIndex, termIndex, field, value) => {
    setOffers((prev) => {
      const next = [...prev];
      const offer = next[offerIndex];
      const terms = [...offer.terms];
      terms[termIndex] = { ...terms[termIndex], [field]: value };
      next[offerIndex] = { ...offer, terms };
      return next;
    });
  };

  const toggleTermSelection = (offerId, termId, checked) => {
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

    setOffers((prev) =>
      prev.map((offer) =>
        offer.id !== offerId
          ? offer
          : {
              ...offer,
              terms: offer.terms.map((term) =>
                term.id === termId ? { ...term, selected: checked } : term,
              ),
            },
      ),
    );
  };

  const addTermToOffer = (offerIndex) => {
    setOffers((prev) => {
      const next = [...prev];
      const offer = next[offerIndex];
      const newTerm = {
        id: `${offer.id}-term-${offer.terms.length + 1}`,
        term: '',
        installment: '',
        netAmount: '',
        totalAmount: '',
        selected: false,
      };
      next[offerIndex] = { ...offer, terms: [...offer.terms, newTerm] };
      return next;
    });
  };

  const removeTermFromOffer = (offerIndex, termIndex) => {
    setOffers((prev) => {
      const next = [...prev];
      const offer = next[offerIndex];
      if (offer.terms.length <= 1) {
        return prev;
      }
      const term = offer.terms[termIndex];
      const updatedSelection = selection.filter(
        (entry) => !(entry.offerId === offer.id && entry.termId === term.id),
      );
      setSelection(updatedSelection);
      next[offerIndex] = {
        ...offer,
        terms: offer.terms.filter((_, idx) => idx !== termIndex),
      };
      return next;
    });
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

    const hasSelectedTerms = ensureSelectionHasItems(selection);
    if (!hasSelectedTerms) {
      nextErrors.selection = isProposalMode
        ? 'Selecione ao menos uma condição para enviar a proposta.'
        : 'Escolha ao menos uma condição para registrar a simulação.';
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
        // já validado anteriormente
      }
    }

    const simulationSnapshot = buildSimulationSnapshot({
      convenio: { id: convenioId, label: convenioLabel },
      product: { id: productId, label: productLabel },
      offers,
    });

    const payload = {
      stage: resolveStageValue(stage) || null,
      leadId: leadId?.trim() ? leadId.trim() : null,
      calculationSnapshot: simulationSnapshot,
      metadata,
    };

    if (isProposalMode) {
      const proposalSnapshot = buildProposalSnapshot({
        simulation: {
          ...simulationSnapshot,
          simulationId,
        },
        selectedOffers: selection,
        message: proposalMessage,
        pdf: { fileName: proposalFileName },
      });
      payload.calculationSnapshot = proposalSnapshot;
      payload.simulationId = simulationId?.trim() ? simulationId.trim() : null;
    }

    await onSubmit?.(payload);
  };

  const title = isProposalMode ? 'Gerar proposta' : 'Registrar simulação';
  const description = isProposalMode
    ? 'Selecione as condições aprovadas e gere automaticamente a proposta com mensagem e PDF.'
    : 'Monte a simulação guiada para acompanhar os bancos, prazos e valores em cada etapa.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {alertsActive ? (
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

          {disabled && disabledReason ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {disabledReason}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sales-convenio">Convênio</Label>
              {errors.convenio ? <p className="text-xs text-rose-400">{errors.convenio}</p> : null}
              <Select
                value={convenioId}
                onValueChange={setConvenioId}
                disabled={fieldsDisabled}
              >
                <SelectTrigger id="sales-convenio">
                  <SelectValue placeholder="Selecione um convênio" />
                </SelectTrigger>
                <SelectContent>
                  {CONVENIO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales-product">Produto</Label>
              {errors.product ? <p className="text-xs text-rose-400">{errors.product}</p> : null}
              <Select
                value={productId}
                onValueChange={setProductId}
                disabled={fieldsDisabled || productOptions.length === 0}
              >
                <SelectTrigger id="sales-product">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {(productOptions.length > 0 ? productOptions : [NO_PRODUCT_OPTION]).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sales-stage">Estágio</Label>
              <Select
                value={stage}
                onValueChange={setStage}
                disabled={fieldsDisabled}
              >
                <SelectTrigger id="sales-stage" ref={stageTriggerRef}>
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
              <Label htmlFor="sales-lead">Lead (opcional)</Label>
              <Input
                id="sales-lead"
                value={leadId}
                onChange={(event) => setLeadId(event.target.value)}
                placeholder="lead-123"
                disabled={fieldsDisabled}
              />
            </div>
            {isProposalMode ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sales-simulation">Simulação vinculada</Label>
                <Input
                  id="sales-simulation"
                  value={simulationId}
                  onChange={(event) => setSimulationId(event.target.value)}
                  disabled
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Bancos e condições</h3>
                <p className="text-xs text-foreground-muted">
                  Escolha prazos e valores que farão parte da {isProposalMode ? 'proposta' : 'simulação'}.
                </p>
              </div>
              {errors.selection ? <span className="text-xs text-rose-400">{errors.selection}</span> : null}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {offers.map((offer, offerIndex) => {
                const isInteractive = !isProposalMode || offers[offerIndex].bankName.trim().length === 0;
                return (
                  <div
                    key={offer.id}
                    className="flex flex-col gap-3 rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor={`${offer.id}-bank`}>Banco #{offer.rank}</Label>
                      <Input
                        id={`${offer.id}-bank`}
                        value={offer.bankName}
                        onChange={(event) => handleOfferChange(offerIndex, 'bankName', event.target.value)}
                        placeholder="Nome do banco"
                        disabled={fieldsDisabled || isProposalMode}
                      />
                      <Input
                        value={offer.table}
                        onChange={(event) => handleOfferChange(offerIndex, 'table', event.target.value)}
                        placeholder="Tabela / campanha"
                        disabled={fieldsDisabled || isProposalMode}
                      />
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                        Prazos e parcelas
                      </span>
                      <div className="space-y-2">
                        {offer.terms.map((term, termIndex) => {
                          const termSelected = selection.some(
                            (entry) => entry.offerId === offer.id && entry.termId === term.id,
                          );
                          return (
                            <div
                              key={term.id}
                              className="rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet/80 p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                                  <Checkbox
                                    id={`${offer.id}-term-${term.id}`}
                                    checked={termSelected}
                                    onCheckedChange={(checked) =>
                                      toggleTermSelection(offer.id, term.id, Boolean(checked))
                                    }
                                    disabled={fieldsDisabled}
                                  />
                                  Incluir
                                </label>
                                {offer.terms.length > 1 ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => removeTermFromOffer(offerIndex, termIndex)}
                                    disabled={fieldsDisabled}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                  </Button>
                                ) : null}
                              </div>
                              <div className="mt-2 grid gap-2">
                                <Input
                                  value={term.term}
                                  onChange={(event) => handleTermChange(offerIndex, termIndex, 'term', event.target.value)}
                                  placeholder="Prazo (meses)"
                                  disabled={fieldsDisabled || isProposalMode}
                                />
                                <Input
                                  value={term.installment}
                                  onChange={(event) =>
                                    handleTermChange(offerIndex, termIndex, 'installment', event.target.value)
                                  }
                                  placeholder="Parcela (R$)"
                                  disabled={fieldsDisabled || isProposalMode}
                                />
                                <Input
                                  value={term.netAmount}
                                  onChange={(event) =>
                                    handleTermChange(offerIndex, termIndex, 'netAmount', event.target.value)
                                  }
                                  placeholder="Valor líquido (R$)"
                                  disabled={fieldsDisabled || isProposalMode}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {!fieldsDisabled ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => addTermToOffer(offerIndex)}
                          disabled={fieldsDisabled || isProposalMode}
                        >
                          <Plus className="mr-2 h-3.5 w-3.5" aria-hidden />
                          Adicionar prazo
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
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
                <Button type="button" size="sm" variant="outline" onClick={handleCopyMessage}>
                  <Copy className="mr-2 h-3.5 w-3.5" aria-hidden />
                  Copiar mensagem
                </Button>
              </div>
              <Textarea
                className="mt-3 min-h-[120px] text-sm"
                value={proposalMessage}
                readOnly
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <Label htmlFor="sales-pdf">Arquivo PDF</Label>
                  <Input id="sales-pdf" value={proposalFileName} readOnly className="mt-1" />
                </div>
                <div className="text-xs text-foreground-muted">
                  O PDF será gerado automaticamente com base na proposta selecionada.
                </div>
              </div>
            </div>
          ) : null}

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
                {errors.metadata ? (
                  <p className="text-[11px] text-rose-400">{errors.metadata}</p>
                ) : null}
                <Textarea
                  className="mt-1 font-mono text-xs"
                  value={metadataText}
                  onChange={(event) => setMetadataText(event.target.value)}
                  placeholder={`{
  "origin": "chat"
}`}
                  minRows={4}
                  disabled={fieldsDisabled}
                />
              </div>
            </div>
          </details>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || fieldsDisabled}>
            {isSubmitting ? 'Enviando…' : isProposalMode ? 'Gerar proposta' : 'Registrar simulação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SimulationModal;
