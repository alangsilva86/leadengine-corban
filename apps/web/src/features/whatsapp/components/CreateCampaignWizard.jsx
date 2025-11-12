import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Phone,
  Plug,
  Shapes,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import useAgreements from '@/features/agreements/useAgreements.js';
import {
  WHATSAPP_CAMPAIGN_PRODUCTS,
  findCampaignProduct,
  findCampaignStrategy,
} from '@/features/whatsapp/utils/campaign-options.js';
import { cn } from '@/lib/utils.js';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativar imediatamente' },
  { value: 'paused', label: 'Criar pausada' },
  { value: 'draft', label: 'Salvar como rascunho' },
];

const STEP_SEQUENCE = [
  {
    key: 'instance',
    title: 'Instância',
    description: 'Selecione e conecte o número.',
  },
  {
    key: 'agreement',
    title: 'Origem',
    description: 'Convênio e fonte de entrada.',
  },
  {
    key: 'product',
    title: 'Produto & margem',
    description: 'Combine produto e margem.',
  },
  {
    key: 'strategy',
    title: 'Estratégia',
    description: 'Defina a régua do lead.',
  },
  {
    key: 'review',
    title: 'Revisão',
    description: 'Confirme antes de criar.',
  },
];

const STEP_DEPENDENCIES = {
  agreement: ['instance'],
  product: ['agreement'],
  strategy: ['product'],
  review: ['strategy'],
};

const LEAD_SOURCE_OPTIONS = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'internal_list', label: 'Lista interna' },
  { value: 'partner', label: 'Parceiro' },
];

const LEAD_SOURCE_LABELS = LEAD_SOURCE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const SEGMENT_OPTIONS = [
  { value: 'active_clients', label: 'Carteira ativa' },
  { value: 'public_workers', label: 'Servidores públicos' },
  { value: 'new_leads', label: 'Novos leads' },
];

const PRODUCT_RULES = {
  consigned_credit: ['Até 35% da margem consignável', 'Sem seguro obrigatório'],
  benefit_card: ['Até 100% quando o convênio permitir', 'Sem seguro obrigatório'],
  salary_portability: ['Sem custo de portabilidade', 'Acompanhamento em D+1'],
};

const STRATEGY_CARDS = [
  {
    value: 'reactive_inbound',
    title: 'HOT',
    definition: 'Contato imediato para leads com interesse alto.',
    cadence: '3 toques/48h',
    compliance: null,
  },
  {
    value: 'proactive_followup',
    title: 'WARM',
    definition: 'Reforços agendados para leads em avaliação.',
    cadence: '2 toques/72h',
    compliance: null,
  },
  {
    value: 'hybrid',
    title: 'COLD',
    definition: 'Nutrição gradual para leads frios.',
    cadence: '1 toque/96h',
    compliance: 'Consentimento antes de dados sensíveis',
  },
];

const formatInstanceLabel = (instance) => {
  if (!instance) {
    return '';
  }
  if (typeof instance.name === 'string' && instance.name.trim().length > 0) {
    return instance.name.trim();
  }
  if (typeof instance.displayName === 'string' && instance.displayName.trim().length > 0) {
    return instance.displayName.trim();
  }
  if (typeof instance.id === 'string' && instance.id.trim().length > 0) {
    return instance.id.trim();
  }
  return 'Instância WhatsApp';
};

const formatAgreementLabel = (agreement) => {
  if (!agreement) {
    return '';
  }
  if (typeof agreement.name === 'string' && agreement.name.trim().length > 0) {
    return agreement.name.trim();
  }
  if (typeof agreement.displayName === 'string' && agreement.displayName.trim().length > 0) {
    return agreement.displayName.trim();
  }
  if (typeof agreement.id === 'string' && agreement.id.trim().length > 0) {
    return agreement.id.trim();
  }
  return 'Origem';
};

const buildSuggestedName = ({ agreementLabel, instanceLabel, productLabel }) => {
  const parts = [];
  if (agreementLabel) {
    parts.push(agreementLabel);
  }
  if (productLabel) {
    parts.push(productLabel);
  }
  if (instanceLabel) {
    parts.push(instanceLabel);
  }
  if (parts.length === 0) {
    return 'Nova campanha do WhatsApp';
  }
  return parts.join(' • ');
};

const collectAllowedProducts = (agreement) => {
  if (!agreement) {
    return null;
  }
  const candidates = [
    agreement.allowedProducts,
    agreement.products,
    agreement.availableProducts,
    agreement?.metadata?.allowedProducts,
  ].filter((entry) => Array.isArray(entry) && entry.length > 0);
  if (candidates.length === 0) {
    return null;
  }
  return new Set(candidates[0]);
};

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
  const { agreements, isLoading: agreementsLoading, error: agreementsError, retry } = useAgreements();
  const [stepIndex, setStepIndex] = useState(0);
  const [formState, setFormState] = useState({
    instanceId: '',
    agreementId: '',
    agreementName: '',
    product: '',
    margin: '',
    strategy: '',
    status: 'active',
    name: '',
    leadSource: LEAD_SOURCE_OPTIONS[0]?.value ?? 'inbound',
    segments: [],
  });
  const [nameDirty, setNameDirty] = useState(false);
  const [stepError, setStepError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    onSubmittingChange?.(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

  const sortedInstances = useMemo(() => {
    return [...instances]
      .filter(Boolean)
      .map((entry) => ({
        ...entry,
        sortKey: formatInstanceLabel(entry).toLowerCase(),
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'pt-BR'));
  }, [instances]);

  const connectedInstances = useMemo(
    () => sortedInstances.filter((instance) => Boolean(instance?.connected)),
    [sortedInstances],
  );

  const hasInstances = sortedInstances.length > 0;
  const hasConnectedInstances = connectedInstances.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    const preferredInstance =
      sortedInstances.find((item) => item?.id === defaultInstanceId) ??
      connectedInstances[0] ??
      sortedInstances[0] ??
      null;

    const preferredAgreementId = agreement?.id ?? '';
    const preferredAgreementName = agreement?.name ?? agreement?.displayName ?? '';
    const productLabel = findCampaignProduct(formState.product)?.label ?? '';

    setFormState((prev) => ({
      ...prev,
      instanceId: preferredInstance?.id ?? '',
      agreementId: preferredAgreementId,
      agreementName: preferredAgreementName,
        leadSource: prev.leadSource || (LEAD_SOURCE_OPTIONS[0]?.value ?? 'inbound'),
      segments: Array.isArray(prev.segments) ? prev.segments : [],
      name: nameDirty
        ? prev.name
        : buildSuggestedName({
            agreementLabel: preferredAgreementName,
            productLabel,
            instanceLabel: formatInstanceLabel(preferredInstance),
          }),
    }));
    setStepIndex(0);
    setStepError(null);
    setSubmitError(null);
    setIsSubmitting(false);
    setNameDirty(false);
  }, [
    open,
    agreement?.id,
    agreement?.name,
    agreement?.displayName,
    sortedInstances,
    connectedInstances,
    defaultInstanceId,
    nameDirty,
    formState.product,
  ]);

  const currentStep = STEP_SEQUENCE[stepIndex];
  const selectedInstance = sortedInstances.find((item) => item?.id === formState.instanceId) ?? null;
  const selectedAgreement = agreements.find((item) => item?.id === formState.agreementId) ?? null;
  const selectedProduct = findCampaignProduct(formState.product);
  const selectedStrategy = findCampaignStrategy(formState.strategy);
  const selectedStrategyCard = STRATEGY_CARDS.find((card) => card.value === formState.strategy) ?? null;
  const allowedProducts = useMemo(() => collectAllowedProducts(selectedAgreement), [selectedAgreement]);

  useEffect(() => {
    onSelectionChange?.({
      instance: selectedInstance,
      agreement: selectedAgreement,
      product: selectedProduct,
      strategy: selectedStrategy,
    });
  }, [onSelectionChange, selectedAgreement, selectedInstance, selectedProduct, selectedStrategy]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!nameDirty) {
      const agreementLabel = formatAgreementLabel(selectedAgreement) || formState.agreementName;
      const productLabel = selectedProduct?.label ?? '';
      const instanceLabel = formatInstanceLabel(selectedInstance);
      setFormState((prev) => ({
        ...prev,
        name: buildSuggestedName({ agreementLabel, productLabel, instanceLabel }),
      }));
    }
  }, [open, selectedAgreement, selectedProduct, selectedInstance, nameDirty, formState.agreementName]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFormState((prev) => {
      if (prev.strategy || !selectedProduct) {
        return prev;
      }
      if (selectedProduct.value === 'benefit_card') {
        return { ...prev, strategy: 'reactive_inbound' };
      }
      return prev;
    });
  }, [open, selectedProduct]);

  const stepValidation = useMemo(
    () => ({
      instance: Boolean(selectedInstance?.id) && Boolean(selectedInstance?.connected),
      agreement: Boolean(formState.agreementId),
      product: Boolean(formState.product) && Number(formState.margin) > 0,
      strategy: Boolean(formState.strategy),
      review: Boolean(formState.name?.trim()) && Boolean(formState.status),
    }),
    [selectedInstance, formState.agreementId, formState.product, formState.margin, formState.strategy, formState.name, formState.status],
  );

  const stepStatuses = useMemo(() => {
    const statuses = {};
    STEP_SEQUENCE.forEach((step, index) => {
      if (index === stepIndex) {
        statuses[step.key] = 'current';
        return;
      }
      const dependencies = STEP_DEPENDENCIES[step.key] ?? [];
      const blocked = dependencies.some((depKey) => !stepValidation[depKey]);
      if (blocked) {
        statuses[step.key] = 'blocked';
        return;
      }
      if (stepValidation[step.key] || index < stepIndex) {
        statuses[step.key] = 'completed';
        return;
      }
      statuses[step.key] = 'upcoming';
    });
    return statuses;
  }, [stepIndex, stepValidation]);

  useEffect(() => {
    onStepChange?.({ index: stepIndex, step: currentStep, statuses: stepStatuses });
  }, [currentStep, onStepChange, stepIndex, stepStatuses]);

  const handleInstanceChange = (value) => {
    setFormState((prev) => ({ ...prev, instanceId: value }));
  };

  const handleAgreementChange = (value) => {
    const nextAgreement = agreements.find((item) => item?.id === value) ?? null;
    setFormState((prev) => ({
      ...prev,
      agreementId: value,
      agreementName: formatAgreementLabel(nextAgreement),
    }));
  };

  const handleProductChange = (value) => {
    const product = findCampaignProduct(value);
    setFormState((prev) => ({
      ...prev,
      product: value,
      margin: product ? String(product.defaultMargin ?? '') : prev.margin,
    }));
  };

  const handleMarginChange = (value) => {
    const sanitized = value.replace(/[^0-9.,]/g, '').replace(',', '.');
    setFormState((prev) => ({ ...prev, margin: sanitized }));
  };

  const handleStrategyChange = (value) => {
    setFormState((prev) => ({ ...prev, strategy: value }));
  };

  const handleStatusChange = (value) => {
    setFormState((prev) => ({ ...prev, status: value }));
  };

  const handleLeadSourceChange = (value) => {
    setFormState((prev) => ({ ...prev, leadSource: value }));
  };

  const toggleSegment = (value) => {
    setFormState((prev) => ({
      ...prev,
      segments: prev.segments.includes(value)
        ? prev.segments.filter((item) => item !== value)
        : [...prev.segments, value],
    }));
  };

  const handleNameChange = (event) => {
    setFormState((prev) => ({ ...prev, name: event.target.value }));
    setNameDirty(true);
  };

  const goToStep = (targetIndex) => {
    if (targetIndex < 0 || targetIndex >= STEP_SEQUENCE.length) {
      return;
    }
    const targetKey = STEP_SEQUENCE[targetIndex].key;
    if (stepStatuses[targetKey] === 'blocked') {
      return;
    }
    setStepError(null);
    setSubmitError(null);
    setStepIndex(targetIndex);
  };

  const goToPreviousStep = () => {
    setStepError(null);
    setSubmitError(null);
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const validateCurrentStep = () => {
    switch (currentStep?.key) {
      case 'instance':
        if (!formState.instanceId) {
          return 'Escolha uma instância para continuar.';
        }
        if (selectedInstance && !selectedInstance.connected) {
          return 'Conecte a instância para liberar Origem.';
        }
        return null;
      case 'agreement':
        if (!formState.agreementId) {
          return 'Selecione o convênio responsável pela campanha.';
        }
        return null;
      case 'product': {
        if (!formState.product) {
          return 'Escolha o produto principal da campanha.';
        }
        const numericMargin = Number(formState.margin);
        if (!Number.isFinite(numericMargin) || numericMargin <= 0) {
          return 'Informe uma margem em números positivos.';
        }
        return null;
      }
      case 'strategy':
        if (!formState.strategy) {
          return 'Selecione a estratégia que será aplicada.';
        }
        return null;
      case 'review': {
        if (!formState.name || formState.name.trim().length === 0) {
          return 'Informe um nome para a campanha.';
        }
        if (!formState.status) {
          return 'Selecione o status inicial da campanha.';
        }
        return null;
      }
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
    setStepIndex((prev) => Math.min(STEP_SEQUENCE.length - 1, prev + 1));
  };

  const handleSubmit = async () => {
    const validation = validateCurrentStep();
    if (validation) {
      setStepError(validation);
      return;
    }

    if (isSubmitting) {
      return;
    }

    setStepError(null);
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await onSubmit?.({
        name: formState.name.trim(),
        status: formState.status,
        instanceId: formState.instanceId,
        agreementId: formState.agreementId,
        agreementName: formState.agreementName,
        product: formState.product,
        margin: Number(formState.margin),
        strategy: formState.strategy,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível criar a campanha.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepHeading = (title, description) => (
    <header className="space-y-1">
      <h2 className="text-base font-semibold leading-6 text-foreground md:text-lg">{title}</h2>
      {description ? <p className="text-sm leading-5 text-muted-foreground">{description}</p> : null}
    </header>
  );

  const renderDependencyBadge = (label) => (
    <Badge variant="status" tone="info" className="text-[0.7rem]">
      {label}
    </Badge>
  );

  const getStepBlockedReason = (stepKey) => {
    switch (stepKey) {
      case 'agreement':
        return 'Conecte uma instância para avançar.';
      case 'product':
        return 'Selecione a origem para continuar.';
      case 'strategy':
        return 'Escolha produto e margem antes de seguir.';
      case 'review':
        return 'Finalize as etapas anteriores.';
      default:
        return 'Conclua a etapa anterior para avançar.';
    }
  };

  const renderStepContent = () => {
    switch (currentStep?.key) {
      case 'instance': {
        const isConnected = Boolean(selectedInstance?.connected);
        return (
          <div className="space-y-6">
            {renderStepHeading('Escolha a instância', 'Use um número conectado para receber os leads.')}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaign-instance">Instância</Label>
                <Select value={formState.instanceId} onValueChange={handleInstanceChange}>
                  <SelectTrigger id="campaign-instance">
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedInstances.map((instance) => (
                      <SelectItem key={instance.id ?? formatInstanceLabel(instance)} value={instance.id}>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium leading-5">{formatInstanceLabel(instance)}</span>
                          <span className="text-xs leading-4 text-muted-foreground">
                            {instance.connected ? 'Conectada e pronta para receber leads.' : 'Desconectada — conecte para liberar Origem.'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="status" tone={isConnected ? 'success' : 'warning'}>
                    {isConnected ? 'Conectada' : 'Desconectada'}
                  </Badge>
                  {!isConnected && formState.instanceId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => selectedInstance?.onGenerateQr?.()}
                    >
                      Gerar QR
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {isConnected ? 'Pronta para receber leads.' : 'Conecte para liberar Origem.'}
                </p>
              </div>
            </div>
            {!hasInstances ? (
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground">
                Nenhuma instância encontrada. Gere um QR para conectar e liberar as próximas etapas.
              </div>
            ) : null}
            {hasInstances && !hasConnectedInstances ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-800">
                Você possui instâncias cadastradas, mas nenhuma conectada no momento.
              </div>
            ) : null}
          </div>
        );
      }
      case 'agreement': {
        return (
          <div className="space-y-6">
            {renderStepHeading('Defina a origem de leads', 'Convênio e fonte da campanha.')}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_200px]">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-agreement">Convênio</Label>
                    <Select
                      value={formState.agreementId}
                      onValueChange={handleAgreementChange}
                      disabled={agreementsLoading}
                    >
                      <SelectTrigger id="campaign-agreement">
                        <SelectValue placeholder={agreementsLoading ? 'Carregando…' : 'Selecione o convênio'} />
                      </SelectTrigger>
                      <SelectContent>
                        {agreements.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium leading-5">{formatAgreementLabel(item)}</span>
                              {item.region ? (
                                <span className="text-xs leading-4 text-muted-foreground">{item.region}</span>
                              ) : null}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign-source">Fonte da campanha</Label>
                    <Select value={formState.leadSource} onValueChange={handleLeadSourceChange}>
                      <SelectTrigger id="campaign-source">
                        <SelectValue placeholder="Escolha a fonte" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Carteira / Segmento</Label>
                  <div className="flex flex-wrap gap-2">
                    {SEGMENT_OPTIONS.map((option) => {
                      const isActive = formState.segments.includes(option.value);
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          size="sm"
                          variant={isActive ? 'secondary' : 'outline'}
                          onClick={() => toggleSegment(option.value)}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                {renderDependencyBadge('Produtos serão filtrados pela origem')}
                {agreementsError ? (
                  <div className="text-xs leading-5 text-destructive">
                    {agreementsError}{' '}
                    <button type="button" className="underline" onClick={retry}>
                      Tentar novamente
                    </button>
                  </div>
                ) : null}
                {agreements.length === 0 && !agreementsLoading ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-800">
                    Nenhum convênio disponível para a instância atual.
                  </div>
                ) : null}
              </div>
              <aside className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground">
                A origem filtra os produtos disponíveis no próximo passo.
              </aside>
            </div>
          </div>
        );
      }
      case 'product': {
        return (
          <div className="space-y-6">
            {renderStepHeading('Escolha o produto e a margem', 'Opções válidas para o convênio.')}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_200px]">
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {WHATSAPP_CAMPAIGN_PRODUCTS.map((option) => {
                    const isSelected = formState.product === option.value;
                    const isCompatible = allowedProducts ? allowedProducts.has(option.value) : true;
                    const rules = PRODUCT_RULES[option.value] ?? [];
                    const card = (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isCompatible) {
                            return;
                          }
                          handleProductChange(option.value);
                        }}
                        aria-pressed={isSelected}
                        aria-disabled={!isCompatible}
                        className={cn(
                          'h-full rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border hover:border-primary/40',
                          !isCompatible && 'cursor-not-allowed border-dashed bg-muted/40 text-muted-foreground hover:border-border',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold leading-5">{option.label}</p>
                            <p className="text-xs leading-4 text-muted-foreground">{option.description}</p>
                          </div>
                          {isSelected ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {rules.map((rule) => (
                            <Badge key={rule} variant="status" tone="info" className="text-[0.65rem]">
                              {rule}
                            </Badge>
                          ))}
                        </div>
                      </button>
                    );

                    if (isCompatible) {
                      return (
                        <div key={option.value} className="h-full">
                          {card}
                        </div>
                      );
                    }

                    return (
                      <Tooltip key={option.value} delayDuration={120}>
                        <TooltipTrigger asChild>
                          <span className="block h-full">{card}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Indisponível para o convênio selecionado
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="campaign-margin">Margem alvo (%)</Label>
                    <Input
                      id="campaign-margin"
                      inputMode="decimal"
                      value={formState.margin}
                      onChange={(event) => handleMarginChange(event.target.value)}
                      placeholder="1,5"
                    />
                  </div>
                  <div className="hidden md:block" aria-hidden>
                    <div className="rounded-md border border-dashed border-border/70 bg-muted/10 p-3 text-xs leading-5 text-muted-foreground">
                      Use porcentagem para alinhar metas financeiras e liberar combinações.
                    </div>
                  </div>
                </div>
                {renderDependencyBadge('Combinações seguem o convênio escolhido')}
              </div>
              <aside className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground">
                Sua escolha sugere a estratégia na próxima etapa.
              </aside>
            </div>
          </div>
        );
      }
      case 'strategy': {
        return (
          <div className="space-y-6">
            {renderStepHeading('Selecione a estratégia', 'Régua conforme o perfil do lead.')}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_200px]">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {STRATEGY_CARDS.map((card) => {
                    const isSelected = formState.strategy === card.value;
                    const content = (
                      <button
                        type="button"
                        key={card.value}
                        onClick={() => handleStrategyChange(card.value)}
                        aria-pressed={isSelected}
                        className={cn(
                          'rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border hover:border-primary/40',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold leading-5">{card.title}</span>
                          {isSelected ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                        </div>
                        <p className="mt-2 text-xs leading-4 text-muted-foreground">{card.definition}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="status" tone="info" className="text-[0.65rem]">
                            {card.cadence}
                          </Badge>
                          {card.compliance ? (
                            <Badge variant="status" tone="warning" className="text-[0.65rem]">
                              {card.compliance}
                            </Badge>
                          ) : null}
                        </div>
                      </button>
                    );
                    return content;
                  })}
                </div>
                {renderDependencyBadge('Sugestão automática baseada em Produto & margem')}
              </div>
              <aside className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground">
                Você pode trocar depois na edição da campanha.
              </aside>
            </div>
          </div>
        );
      }
      case 'review': {
        return (
          <div className="space-y-6">
            {renderStepHeading('Revise e crie a campanha', null)}
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-5">Instância</span>
                    <span className="text-sm leading-5 text-muted-foreground">
                      {selectedInstance ? `${formatInstanceLabel(selectedInstance)} • ${selectedInstance.connected ? 'Conectada' : 'Desconectada'}` : '—'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Plug className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-5">Origem</span>
                    <span className="text-sm leading-5 text-muted-foreground">
                      {selectedAgreement ? formatAgreementLabel(selectedAgreement) : '—'}
                      {formState.leadSource ? ` · Fonte: ${LEAD_SOURCE_LABELS[formState.leadSource] ?? '—'}` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Shapes className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-5">Produto & margem</span>
                    <span className="text-sm leading-5 text-muted-foreground">
                      {selectedProduct ? selectedProduct.label : '—'}
                      {formState.margin ? ` · até ${formState.margin}%` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-5">Estratégia</span>
                    <span className="text-sm leading-5 text-muted-foreground">
                      {selectedStrategyCard ? `${selectedStrategyCard.title} · ${selectedStrategyCard.cadence}` : selectedStrategy?.label ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    {stepValidation.instance ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <button
                      type="button"
                      onClick={() => goToStep(0)}
                      className="text-left text-sm leading-5 text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {stepValidation.instance ? 'Instância conectada' : 'Ajustar na Etapa 1'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                  {stepValidation.agreement ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="text-left text-sm leading-5 text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {stepValidation.agreement ? 'Origem válida' : 'Ajustar na Etapa 2'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {stepValidation.product ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="text-left text-sm leading-5 text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {stepValidation.product ? 'Produto compatível' : 'Ajustar na Etapa 3'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {stepValidation.strategy ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="text-left text-sm leading-5 text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {stepValidation.strategy ? 'Estratégia definida' : 'Ajustar na Etapa 4'}
                  </button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Nome da campanha</Label>
                  <Input
                    id="campaign-name"
                    value={formState.name}
                    onChange={handleNameChange}
                    placeholder="Cartão benefício • SAEC Goiânia"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-status-review">Status inicial</Label>
                  <Select value={formState.status} onValueChange={handleStatusChange}>
                    <SelectTrigger id="campaign-status-review">
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
          </div>
        );
      }
      default:
        return null;
    }
  };

  const isLastStep = stepIndex === STEP_SEQUENCE.length - 1;
  const advanceDisabledReason =
    currentStep?.key === 'instance' && selectedInstance && !selectedInstance.connected
      ? 'Conecte a instância para continuar.'
      : null;
  const isAdvanceDisabled = Boolean(advanceDisabledReason) || isSubmitting;

  const instancePhoneLabel =
    selectedInstance?.phoneLabel || selectedInstance?.formattedPhone || selectedInstance?.phone || '—';
  const instanceStatusLabel = selectedInstance?.connected ? 'Saudável' : 'Conectar';
  const instanceStatusTone = selectedInstance?.connected
    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
    : 'bg-amber-500/10 text-amber-200 border border-amber-500/40';

  const SummaryPanel = ({ className = '' }) => (
    <div className={cn('rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4 shadow-inner', className)}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Instância escolhida</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{formatInstanceLabel(selectedInstance) || 'Selecione uma instância'}</span>
        <span className={cn('rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase', instanceStatusTone)}>
          {instanceStatusLabel}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Telefone: {instancePhoneLabel}</p>
      {selectedAgreement ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Origem: <span className="font-medium text-foreground">{formatAgreementLabel(selectedAgreement)}</span>
        </p>
      ) : null}
      {selectedProduct ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Produto: <span className="font-medium text-foreground">{selectedProduct.label}</span>
        </p>
      ) : null}
      {selectedStrategy ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Estratégia: <span className="font-medium text-foreground">{selectedStrategy.title}</span>
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden md:h-[80vh] md:flex-row">
      <aside className="border-b border-border/60 bg-muted/5 px-6 py-4 md:flex md:w-64 md:flex-shrink-0 md:flex-col md:gap-6 md:border-b-0 md:border-r md:bg-background/60 md:px-5 md:py-6">
        <nav className="hidden flex-1 flex-col gap-3 overflow-y-auto pr-1 md:flex">
          {STEP_SEQUENCE.map((step, index) => {
            const status = stepStatuses[step.key];
            const isActive = status === 'current';
            const isCompleted = status === 'completed';
            const isBlocked = status === 'blocked';
            return (
              <Tooltip key={step.key} delayDuration={120}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => goToStep(index)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/70 hover:border-primary/40',
                      isBlocked && 'cursor-not-allowed opacity-60 hover:border-border/70',
                    )}
                    aria-current={isActive ? 'step' : undefined}
                    aria-disabled={isBlocked}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                        isCompleted
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-border text-muted-foreground',
                      )}
                    >
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold leading-4 text-foreground">{step.title}</p>
                      <p className="text-[0.7rem] leading-4 text-muted-foreground">{step.description}</p>
                    </div>
                    {isBlocked ? <Lock className="ml-auto h-4 w-4 text-muted-foreground" /> : null}
                  </button>
                </TooltipTrigger>
                {isBlocked ? (
                  <TooltipContent side="right" align="start" className="max-w-[220px] text-xs">
                    {getStepBlockedReason(step.key)}
                  </TooltipContent>
                ) : null}
              </Tooltip>
            );
          })}
        </nav>
        <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:hidden">
          {STEP_SEQUENCE.map((step, index) => {
            const status = stepStatuses[step.key];
            const isActive = status === 'current';
            const isCompleted = status === 'completed';
            const isBlocked = status === 'blocked';
            return (
              <li key={step.key}>
                <button
                  type="button"
                  onClick={() => goToStep(index)}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/70 text-muted-foreground',
                    isBlocked && 'cursor-not-allowed opacity-60',
                  )}
                  aria-disabled={isBlocked}
                >
                  {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                  {step.title}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="hidden md:block">
          <SummaryPanel />
        </div>
      </aside>
      <section className="relative flex flex-1 flex-col bg-background">
        <div className="flex-1 overflow-y-auto px-6 pb-28 pt-4 md:px-8 md:pb-36 md:pt-6">
          <div className="mb-4 md:hidden">
            <SummaryPanel />
          </div>
          <div className="space-y-6">
            {renderStepContent()}
            {stepError ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm leading-5 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{stepError}</span>
              </div>
            ) : null}
            {submitError ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm leading-5 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{submitError}</span>
              </div>
            ) : null}
          </div>
        </div>
        <footer className="absolute inset-x-0 bottom-0 border-t border-border/70 bg-background/95 px-6 py-4 backdrop-blur md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={goToPreviousStep}
                disabled={stepIndex === 0 || isSubmitting}
              >
                Voltar
              </Button>
              {isLastStep ? (
                <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Criando…' : 'Criar campanha'}
                </Button>
              ) : (
                <Tooltip delayDuration={120}>
                  <TooltipTrigger asChild>
                    <span>
                      <Button type="button" onClick={goToNextStep} disabled={isAdvanceDisabled}>
                        Avançar
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {advanceDisabledReason ? (
                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                      {advanceDisabledReason}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              )}
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default CreateCampaignWizard;
export { STEP_SEQUENCE };
