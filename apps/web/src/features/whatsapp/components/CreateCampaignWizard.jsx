import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { WHATSAPP_CAMPAIGN_PRODUCTS, findCampaignProduct, findCampaignStrategy } from '@/features/whatsapp/utils/campaign-options.js';
import { cn } from '@/lib/utils.js';

import CampaignSummary from './campaign-wizard/CampaignSummary.jsx';
import StepperRail from './campaign-wizard/StepperRail.jsx';
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_OPTIONS,
  PRODUCT_RULES,
  STATUS_OPTIONS,
  STEP_DEPENDENCIES,
  STEP_SEQUENCE,
  STRATEGY_CARDS,
  TOTAL_STEPS,
  findStrategyCard,
  slugifyOrigin,
} from './campaign-wizard/constants.js';
import { NumberStatusDot } from './numbers/NumberStatusBadge';
import SafetyTipsPopover from './SafetyTips';
import { formatWhatsAppNumber } from '@/lib/phone';
import { resolveInstancePhone, selectPreferredInstance } from '../lib/instances';
import { getNumberStatus } from '../lib/numberStatus';

const formatNumberLabel = (instance) => {
  if (!instance) return '';
  const name = typeof instance.name === 'string' && instance.name.trim() ? instance.name.trim() : null;
  return name ?? formatWhatsAppNumber(resolveInstancePhone(instance)) ?? 'Número sem nome';
};

const buildSuggestedName = ({ originLabel, productLabel }) => {
  const parts = [originLabel, productLabel].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Nova regra';
};

const readAgreementPrefill = (agreement) => ({
  agreementId: typeof agreement?.id === 'string' ? agreement.id : '',
  agreementName: typeof agreement?.name === 'string' ? agreement.name : '',
});

const StepHeading = ({ title, description, headingRef }) => (
  <header ref={headingRef} tabIndex={-1} className="space-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
  </header>
);

const SelectableCard = ({ selected, disabled = false, onSelect, children, className, ...props }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    disabled={disabled}
    className={cn(
      'flex w-full flex-col items-stretch justify-start rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover',
      disabled && 'cursor-not-allowed opacity-60 hover:border-border hover:bg-surface',
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

/**
 * Assistente de criação de regra (5 etapas).
 * O payload enviado é exatamente: name, status, instanceId, agreementId, agreementName,
 * leadSource, product, margin, strategy, segments.
 */
const CreateCampaignWizard = ({
  open,
  agreement,
  instances = [],
  defaultInstanceId,
  onSubmit,
  onCancel,
  onSubmittingChange,
  onStepChange,
  onSelectionChange,
}) => {
  const ids = {
    sourceName: useId(),
    sourceId: useId(),
    margin: useId(),
    name: useId(),
    status: useId(),
    consent: useId(),
  };
  const [stepIndex, setStepIndex] = useState(0);
  const [formState, setFormState] = useState(() => ({
    instanceId: '',
    ...readAgreementPrefill(agreement),
    product: '',
    margin: '',
    strategy: '',
    status: 'active',
    name: '',
    leadSource: LEAD_SOURCE_OPTIONS[0].value,
    segments: [],
  }));
  const [nameDirty, setNameDirty] = useState(false);
  const [sourceIdDirty, setSourceIdDirty] = useState(Boolean(agreement?.id));
  const [consentGiven, setConsentGiven] = useState(false);
  const [stepError, setStepError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFocusStep, setPendingFocusStep] = useState(null);
  const stepHeadingRefs = useRef({});
  const isSessionActiveRef = useRef(false);

  useEffect(() => {
    onSubmittingChange?.(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

  const numberOptions = useMemo(
    () =>
      instances
        .filter((instance) => instance && typeof instance.id === 'string')
        .map((instance) => ({
          instance,
          id: instance.id,
          label: formatNumberLabel(instance),
          phone: formatWhatsAppNumber(resolveInstancePhone(instance)),
          status: getNumberStatus(instance),
          connected: Boolean(instance.connected),
        })),
    [instances],
  );
  const hasConnectedNumbers = numberOptions.some((option) => option.connected);

  // Prepara o formulário a cada abertura (mantém o progresso enquanto o diálogo segue aberto).
  useEffect(() => {
    if (!open) {
      isSessionActiveRef.current = false;
      return;
    }
    const connectedList = instances.filter((instance) => Boolean(instance?.connected));
    const preferred =
      selectPreferredInstance(instances, { preferredInstanceId: defaultInstanceId ?? null }) ??
      connectedList[0] ??
      instances[0] ??
      null;
    const isFirstOpen = !isSessionActiveRef.current;
    isSessionActiveRef.current = true;

    setFormState((prev) => ({
      ...prev,
      instanceId:
        prev.instanceId && instances.some((item) => item?.id === prev.instanceId) ? prev.instanceId : preferred?.id ?? '',
    }));

    if (isFirstOpen) {
      setStepIndex(0);
      setNameDirty(false);
      setConsentGiven(false);
    }
    setStepError(null);
    setSubmitError(null);
    setIsSubmitting(false);
  }, [open, instances, defaultInstanceId]);

  const currentStep = STEP_SEQUENCE[stepIndex];
  const selectedOption = numberOptions.find((option) => option.id === formState.instanceId) ?? null;
  const selectedInstance = selectedOption?.instance ?? null;
  const selectedProduct = findCampaignProduct(formState.product);
  const selectedStrategy = findCampaignStrategy(formState.strategy);
  const selectedStrategyCard = findStrategyCard(formState.strategy);
  const needsConsent = Boolean(selectedStrategyCard?.proactive);
  const originLabel = formState.agreementName.trim() || null;

  useEffect(() => {
    onSelectionChange?.({
      instance: selectedInstance,
      agreement: originLabel ? { id: formState.agreementId, name: originLabel } : null,
      product: selectedProduct,
      strategy: selectedStrategy,
    });
  }, [formState.agreementId, onSelectionChange, originLabel, selectedInstance, selectedProduct, selectedStrategy]);

  const suggestedCampaignName = useMemo(
    () => buildSuggestedName({ originLabel, productLabel: selectedProduct?.label ?? null }),
    [originLabel, selectedProduct],
  );

  useEffect(() => {
    if (!open || nameDirty) return;
    setFormState((prev) => (prev.name === suggestedCampaignName ? prev : { ...prev, name: suggestedCampaignName }));
  }, [open, nameDirty, suggestedCampaignName]);

  // Cartão benefício costuma vir de quem já chamou: sugere "Resposta imediata".
  useEffect(() => {
    if (!open) return;
    setFormState((prev) => {
      if (prev.strategy || !selectedProduct || selectedProduct.value !== 'benefit_card') return prev;
      return { ...prev, strategy: 'reactive_inbound' };
    });
  }, [open, selectedProduct]);

  const stepValidation = useMemo(
    () => ({
      instance: Boolean(selectedOption?.connected),
      agreement: Boolean(formState.agreementId.trim()) && Boolean(formState.agreementName.trim()),
      product: Boolean(formState.product) && Number(formState.margin) > 0,
      strategy: Boolean(formState.strategy) && (!needsConsent || consentGiven),
      review: Boolean(formState.name?.trim()) && Boolean(formState.status),
    }),
    [consentGiven, formState, needsConsent, selectedOption],
  );

  const stepStatuses = useMemo(() => {
    const statuses = {};
    STEP_SEQUENCE.forEach((step, index) => {
      if (index === stepIndex) {
        statuses[step.key] = 'current';
        return;
      }
      const blocked = (STEP_DEPENDENCIES[step.key] ?? []).some((dep) => !stepValidation[dep]);
      if (blocked) {
        statuses[step.key] = 'blocked';
      } else if (stepValidation[step.key] || index < stepIndex) {
        statuses[step.key] = 'completed';
      } else {
        statuses[step.key] = 'upcoming';
      }
    });
    return statuses;
  }, [stepIndex, stepValidation]);

  useEffect(() => {
    onStepChange?.({ index: stepIndex, step: currentStep, statuses: stepStatuses });
  }, [currentStep, onStepChange, stepIndex, stepStatuses]);

  useEffect(() => {
    if (!pendingFocusStep) return undefined;
    const frame = requestAnimationFrame(() => {
      const heading = stepHeadingRefs.current[pendingFocusStep];
      if (heading) {
        heading.focus({ preventScroll: true });
        heading.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      }
      setPendingFocusStep(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingFocusStep]);

  const update = (patch) => setFormState((prev) => ({ ...prev, ...patch }));

  const goToStep = (targetIndex) => {
    if (targetIndex < 0 || targetIndex >= STEP_SEQUENCE.length) return;
    const targetKey = STEP_SEQUENCE[targetIndex].key;
    if (stepStatuses[targetKey] === 'blocked') return;
    setStepError(null);
    setSubmitError(null);
    setPendingFocusStep(targetKey);
    setStepIndex(targetIndex);
  };

  const validateCurrentStep = () => {
    switch (currentStep?.key) {
      case 'instance':
        if (!formState.instanceId) return 'Escolha o número que vai receber os leads.';
        if (!selectedOption?.connected) return 'Este número não está conectado. Escolha um número conectado.';
        return null;
      case 'agreement':
        if (!formState.agreementName.trim()) return 'Informe o nome da origem dos leads (ex.: INSS).';
        if (!formState.agreementId.trim()) return 'Informe o código da origem.';
        return null;
      case 'product': {
        if (!formState.product) return 'Escolha o produto da regra.';
        const margin = Number(formState.margin);
        if (!Number.isFinite(margin) || margin <= 0) return 'Informe uma margem maior que zero.';
        return null;
      }
      case 'strategy':
        if (!formState.strategy) return 'Escolha como o time vai atender esses leads.';
        if (needsConsent && !consentGiven) return 'Confirme que os contatos autorizaram receber mensagens.';
        return null;
      case 'review':
        if (!formState.name.trim()) return 'Dê um nome para a regra.';
        if (!formState.status) return 'Escolha como a regra começa.';
        return null;
      default:
        return null;
    }
  };

  const goToNextStep = () => {
    const validation = validateCurrentStep();
    if (validation) {
      setStepError(validation);
      return;
    }
    setStepError(null);
    const next = Math.min(STEP_SEQUENCE.length - 1, stepIndex + 1);
    setPendingFocusStep(STEP_SEQUENCE[next].key);
    setStepIndex(next);
  };

  const goToPreviousStep = () => {
    setStepError(null);
    setSubmitError(null);
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSubmit = async () => {
    const validation = validateCurrentStep();
    if (validation) {
      setStepError(validation);
      return;
    }
    if (isSubmitting) return;

    setStepError(null);
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const normalizedSegments = Array.from(
        new Set(
          (Array.isArray(formState.segments) ? formState.segments : [])
            .map((segment) => (typeof segment === 'string' ? segment.trim() : ''))
            .filter(Boolean),
        ),
      );

      await onSubmit?.({
        name: formState.name.trim(),
        status: formState.status,
        instanceId: formState.instanceId,
        agreementId: formState.agreementId.trim(),
        agreementName: formState.agreementName.trim(),
        leadSource: formState.leadSource,
        product: formState.product,
        margin: Number(formState.margin),
        strategy: formState.strategy,
        segments: normalizedSegments,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível criar a regra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const headingRef = (stepKey) => (node) => {
    if (node) stepHeadingRefs.current[stepKey] = node;
    else delete stepHeadingRefs.current[stepKey];
  };

  const renderStepContent = () => {
    switch (currentStep?.key) {
      case 'instance':
        return (
          <div className="space-y-5">
            <StepHeading
              headingRef={headingRef('instance')}
              title="Qual número recebe os leads?"
              description="Os leads desta regra chegam neste WhatsApp e aparecem na Inbox."
            />
            {numberOptions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Você ainda não tem números.{' '}
                <Link to="/channels?connect=1" className="font-medium text-primary hover:underline">
                  Conectar número
                </Link>
              </p>
            ) : (
              <div role="radiogroup" aria-label="Número de WhatsApp" className="grid gap-2">
                {numberOptions.map((option) => {
                  const selected = option.id === formState.instanceId;
                  return (
                    <SelectableCard
                      key={option.id}
                      role="radio"
                      aria-checked={selected}
                      aria-pressed={undefined}
                      selected={selected}
                      disabled={!option.connected}
                      onSelect={() => update({ instanceId: option.id })}
                      className="flex-row items-center justify-between gap-3 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{option.label}</span>
                        {option.phone ? <span className="block text-xs tabular-nums text-muted-foreground">{option.phone}</span> : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <NumberStatusDot status={option.status} />
                        {option.status.label}
                      </span>
                    </SelectableCard>
                  );
                })}
              </div>
            )}
            {numberOptions.length > 0 && !hasConnectedNumbers ? (
              <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
                Nenhum número está conectado agora.{' '}
                <Link to="/channels" className="font-medium underline underline-offset-2">
                  Reconectar em WhatsApp
                </Link>
              </p>
            ) : null}
            {selectedOption && !selectedOption.connected && hasConnectedNumbers ? (
              <p className="text-sm text-muted-foreground">Escolha um número conectado para continuar.</p>
            ) : null}
          </div>
        );
      case 'agreement':
        return (
          <div className="space-y-5">
            <StepHeading
              headingRef={headingRef('agreement')}
              title="De onde vêm os leads?"
              description="A origem é o convênio ou parceiro dos leads. Ela identifica a regra no CRM e nos relatórios."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={ids.sourceName}>Nome da origem</Label>
                <Input
                  id={ids.sourceName}
                  value={formState.agreementName}
                  onChange={(event) => {
                    const value = event.target.value ?? '';
                    update(sourceIdDirty ? { agreementName: value } : { agreementName: value, agreementId: slugifyOrigin(value) });
                  }}
                  placeholder="Ex.: INSS, SIAPE, Prefeitura de Goiânia"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={ids.sourceId}>Código da origem</Label>
                <Input
                  id={ids.sourceId}
                  value={formState.agreementId}
                  onChange={(event) => {
                    setSourceIdDirty(true);
                    update({ agreementId: event.target.value ?? '' });
                  }}
                  placeholder="Ex.: inss"
                  autoComplete="off"
                  aria-describedby={`${ids.sourceId}-hint`}
                />
                <p id={`${ids.sourceId}-hint`} className="text-xs text-muted-foreground">
                  Gerado a partir do nome. Use o código do parceiro se ele já tiver um.
                </p>
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Como os leads chegam</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {LEAD_SOURCE_OPTIONS.map((option) => (
                  <SelectableCard
                    key={option.value}
                    selected={formState.leadSource === option.value}
                    onSelect={() => update({ leadSource: option.value })}
                    className="py-3"
                  >
                    <span className="block text-sm font-medium text-foreground">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
                  </SelectableCard>
                ))}
              </div>
            </fieldset>
          </div>
        );
      case 'product':
        return (
          <div className="space-y-5">
            <StepHeading headingRef={headingRef('product')} title="Qual produto será oferecido?" description="A margem alvo ajuda o time a priorizar propostas." />
            <div className="grid gap-2 sm:grid-cols-3">
              {WHATSAPP_CAMPAIGN_PRODUCTS.map((option) => {
                const isSelected = formState.product === option.value;
                return (
                  <SelectableCard
                    key={option.value}
                    selected={isSelected}
                    onSelect={() => update({ product: option.value, margin: String(option.defaultMargin ?? '') })}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{option.label}</span>
                      {isSelected ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-primary" /> : null}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                    <ul className="mt-3 space-y-1">
                      {(PRODUCT_RULES[option.value] ?? []).map((rule) => (
                        <li key={rule} className="text-xs text-muted-foreground">
                          · {rule}
                        </li>
                      ))}
                    </ul>
                  </SelectableCard>
                );
              })}
            </div>
            <div className="max-w-48 space-y-2">
              <Label htmlFor={ids.margin}>Margem alvo (%)</Label>
              <Input
                id={ids.margin}
                inputMode="decimal"
                value={formState.margin}
                onChange={(event) => update({ margin: event.target.value.replace(/[^0-9.,]/g, '').replace(',', '.') })}
                placeholder="1,5"
              />
            </div>
          </div>
        );
      case 'strategy':
        return (
          <div className="space-y-5">
            <StepHeading
              headingRef={headingRef('strategy')}
              title="Como o time vai atender?"
              description="Define o ritmo de contato com cada lead. Você pode mudar depois."
            />
            <div className="grid gap-2 md:grid-cols-3">
              {STRATEGY_CARDS.map((card) => {
                const isSelected = formState.strategy === card.value;
                return (
                  <SelectableCard
                    key={card.value}
                    selected={isSelected}
                    onSelect={() => {
                      update({ strategy: card.value });
                      if (!card.proactive) setConsentGiven(false);
                    }}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{card.title}</span>
                      {isSelected ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-primary" /> : null}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{card.definition}</span>
                    <span className="mt-3 block text-xs font-medium text-foreground">{card.cadence}</span>
                    {card.proactive ? (
                      <span className="mt-1 block text-xs text-muted-foreground">O time envia a primeira mensagem.</span>
                    ) : null}
                  </SelectableCard>
                );
              })}
            </div>
            {needsConsent ? (
              <div className="space-y-3 rounded-lg border border-border bg-surface-sunken p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                  <p className="text-sm text-muted-foreground">
                    Nesta forma de atendimento o time inicia a conversa. Mensagens para quem não pediu contato geram denúncias e
                    podem bloquear o número.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={ids.consent}
                    checked={consentGiven}
                    onCheckedChange={(value) => {
                      setConsentGiven(value === true);
                      setStepError(null);
                    }}
                    className="mt-0.5"
                  />
                  <Label htmlFor={ids.consent} className="text-sm font-normal leading-5 text-foreground">
                    Confirmo que estes contatos autorizaram receber mensagens da minha empresa pelo WhatsApp.
                  </Label>
                </div>
                <SafetyTipsPopover align="start" />
              </div>
            ) : null}
          </div>
        );
      case 'review': {
        const rows = [
          { key: 'instance', label: 'Número', value: selectedOption ? `${selectedOption.label}${selectedOption.phone ? ` · ${selectedOption.phone}` : ''}` : '—', step: 0 },
          {
            key: 'agreement',
            label: 'Origem',
            value: originLabel ? `${originLabel} · ${LEAD_SOURCE_LABELS[formState.leadSource] ?? ''}` : '—',
            step: 1,
          },
          {
            key: 'product',
            label: 'Produto',
            value: selectedProduct ? `${selectedProduct.label} · margem ${`${formState.margin}`.replace('.', ',')}%` : '—',
            step: 2,
          },
          { key: 'strategy', label: 'Atendimento', value: selectedStrategyCard ? `${selectedStrategyCard.title} · ${selectedStrategyCard.cadence}` : '—', step: 3 },
        ];
        return (
          <div className="space-y-5">
            <StepHeading headingRef={headingRef('review')} title="Revise e crie a regra" />
            <dl className="divide-y divide-border rounded-lg border border-border">
              {rows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="truncate text-sm font-medium text-foreground">{row.value}</dd>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => goToStep(row.step)} aria-label={`Alterar ${row.label.toLowerCase()}`}>
                    Alterar
                  </Button>
                </div>
              ))}
            </dl>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={ids.name}>Nome da regra</Label>
                <Input
                  id={ids.name}
                  value={formState.name}
                  onChange={(event) => {
                    update({ name: event.target.value });
                    setNameDirty(true);
                  }}
                  placeholder="INSS · Cartão benefício"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={ids.status}>Ao criar</Label>
                <Select value={formState.status} onValueChange={(value) => update({ status: value })}>
                  <SelectTrigger id={ids.status} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const isLastStep = stepIndex === TOTAL_STEPS - 1;
  const advanceDisabledReason =
    currentStep?.key === 'instance' && !selectedOption?.connected
      ? numberOptions.length === 0
        ? 'Conecte um número primeiro.'
        : 'Escolha um número conectado.'
      : null;
  const isAdvanceDisabled = Boolean(advanceDisabledReason) || isSubmitting;
  const errorMessage = stepError ?? submitError;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StepperRail stepStatuses={stepStatuses} onSelectStep={goToStep} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-start lg:gap-8">
          <section className="min-w-0 flex-1 space-y-5" aria-live="off">
            {renderStepContent()}
            {errorMessage ? (
              <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {errorMessage}
              </p>
            ) : null}
          </section>
          <aside className="hidden w-64 shrink-0 lg:block">
            <CampaignSummary
              numberLabel={selectedOption?.label ?? null}
              originLabel={originLabel}
              leadSource={formState.leadSource}
              productLabel={selectedProduct?.label ?? null}
              margin={formState.margin}
              strategyCard={selectedStrategyCard}
              status={formState.status}
            />
          </aside>
        </div>
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 sm:px-6">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <div className="flex items-center gap-2">
          {stepIndex > 0 ? (
            <Button type="button" variant="outline" onClick={goToPreviousStep} disabled={isSubmitting}>
              Voltar
            </Button>
          ) : null}
          {isLastStep ? (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {isSubmitting ? 'Criando…' : 'Criar regra'}
            </Button>
          ) : advanceDisabledReason ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="rounded-md">
                  <Button type="button" disabled>
                    Avançar
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{advanceDisabledReason}</TooltipContent>
            </Tooltip>
          ) : (
            <Button type="button" onClick={goToNextStep} disabled={isAdvanceDisabled}>
              Avançar
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default CreateCampaignWizard;
export { STEP_SEQUENCE, TOTAL_STEPS };
