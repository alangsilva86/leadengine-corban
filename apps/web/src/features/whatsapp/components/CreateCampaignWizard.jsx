import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Loader2,
  Lock,
  Phone,
  Plug,
  Search,
  Shapes,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion.jsx';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import useAgreements from '@/features/agreements/useAgreements.js';
import useMediaQuery from '@/hooks/use-media-query.js';
import {
  WHATSAPP_CAMPAIGN_PRODUCTS,
  findCampaignProduct,
  findCampaignStrategy,
} from '@/features/whatsapp/utils/campaign-options.js';
import { cn } from '@/lib/utils.js';
import { toast } from 'sonner';
import { resolveTenantDisplayName, selectPreferredInstance } from '../lib/instances';

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

export const TOTAL_STEPS = STEP_SEQUENCE.length;

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
  const resolved = resolveTenantDisplayName(agreement);
  if (resolved) {
    return resolved;
  }
  if (typeof agreement?.id === 'string' && agreement.id.trim().length > 0) {
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
  const [pendingFocusStep, setPendingFocusStep] = useState(null);
  const stepHeadingRefs = useRef({});
  const [isAgreementPickerOpen, setIsAgreementPickerOpen] = useState(false);
  const isLg = useMediaQuery('(min-width: 1024px)');

  const agreementsList = useMemo(() => {
    if (!Array.isArray(agreements)) {
      return [];
    }
    return agreements;
  }, [agreements]);
  const tenantContextLabel = useMemo(
    () => resolveTenantDisplayName(agreement),
    [agreement],
  );

  const agreementErrorMessage = useMemo(() => {
    if (!agreementsError) {
      return null;
    }
    if (agreementsError instanceof Error) {
      return agreementsError.message;
    }
    if (typeof agreementsError === 'string') {
      return agreementsError;
    }
    return 'Não foi possível carregar os convênios.';
  }, [agreementsError]);

  useEffect(() => {
    onSubmittingChange?.(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

  useEffect(() => {
    if (!agreementErrorMessage) {
      return;
    }
    toast.error('Erro ao carregar convênios', {
      description: agreementErrorMessage,
      duration: 6000,
    });
  }, [agreementErrorMessage]);

  const connectedInstances = instances.filter((instance) => Boolean(instance?.connected));

  const hasInstances = instances.length > 0;
  const hasConnectedInstances = connectedInstances.length > 0;

  const isModalSessionActiveRef = useRef(false);

  useEffect(() => {
    if (!open) {
      isModalSessionActiveRef.current = false;
      return;
    }

    const connectedList = instances.filter((instance) => Boolean(instance?.connected));

    const preferredInstance =
      selectPreferredInstance(instances, { preferredInstanceId: defaultInstanceId ?? null }) ??
      connectedList[0] ??
      instances[0] ??
      null;

    const preferredAgreementId = agreement?.id ?? '';
    const preferredAgreementName = agreement?.name ?? agreement?.displayName ?? '';

    const isFirstOpen = !isModalSessionActiveRef.current;
    isModalSessionActiveRef.current = true;

    setFormState((prev) => {
      const nextState = {
        ...prev,
        instanceId:
          prev.instanceId && instances.some((item) => item?.id === prev.instanceId)
            ? prev.instanceId
            : preferredInstance?.id ?? '',
        agreementId:
          prev.agreementId && prev.agreementId !== preferredAgreementId && !isFirstOpen
            ? prev.agreementId
            : preferredAgreementId,
        agreementName:
          prev.agreementId && prev.agreementId !== preferredAgreementId && !isFirstOpen
            ? prev.agreementName
            : preferredAgreementName,
        leadSource: prev.leadSource ?? (LEAD_SOURCE_OPTIONS[0]?.value ?? 'inbound'),
        segments: Array.isArray(prev.segments) ? prev.segments : [],
      };

      if (!nextState.agreementId && preferredAgreementId) {
        nextState.agreementId = preferredAgreementId;
        nextState.agreementName = preferredAgreementName;
      }

      return nextState;
    });

    if (isFirstOpen) {
      setStepIndex(0);
      setNameDirty(false);
    }

    setStepError(null);
    setSubmitError(null);
    setIsSubmitting(false);
  }, [
    open,
    instances,
    agreement?.id,
    agreement?.name,
    agreement?.displayName,
    defaultInstanceId,
  ]);

  const currentStep = STEP_SEQUENCE[stepIndex];
  const selectedInstance = instances.find((item) => item?.id === formState.instanceId) ?? null;
  const selectedAgreement = agreementsList.find((item) => item?.id === formState.agreementId) ?? null;
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

  const suggestedCampaignName = useMemo(() => {
    const agreementLabel = formatAgreementLabel(selectedAgreement) || formState.agreementName;
    const productLabel = selectedProduct?.label ?? '';
    const instanceLabel = formatInstanceLabel(selectedInstance);

    return buildSuggestedName({ agreementLabel, productLabel, instanceLabel });
  }, [selectedAgreement, selectedProduct, selectedInstance, formState.agreementName]);

  useEffect(() => {
    if (!open || nameDirty || !suggestedCampaignName) {
      return;
    }

    setFormState((prev) => {
      if (prev.name === suggestedCampaignName) {
        return prev;
      }

      return {
        ...prev,
        name: suggestedCampaignName,
      };
    });
  }, [open, nameDirty, suggestedCampaignName]);

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

  const stepIndexLookup = useMemo(() => {
    const lookup = {};
    STEP_SEQUENCE.forEach((step, index) => {
      lookup[step.key] = index;
    });
    return lookup;
  }, []);

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
    const nextAgreement = agreementsList.find((item) => item?.id === value) ?? null;
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
    setPendingFocusStep(targetKey);
    setStepIndex(targetIndex);
  };

  useEffect(() => {
    if (!pendingFocusStep) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      const targetHeading = stepHeadingRefs.current[pendingFocusStep];
      if (targetHeading) {
        targetHeading.focus({ preventScroll: true });
        targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setPendingFocusStep(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [currentStep?.key, pendingFocusStep]);

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
          return 'Conecte para liberar Origem.';
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
        agreementId: formState.agreementId,
        agreementName: formState.agreementName,
        leadSource: formState.leadSource,
        product: formState.product,
        margin: Number(formState.margin),
        strategy: formState.strategy,
        segments: normalizedSegments,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível criar a campanha.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerStepHeading = (stepKey) => (node) => {
    if (node) {
      stepHeadingRefs.current[stepKey] = node;
    } else {
      delete stepHeadingRefs.current[stepKey];
    }
  };

  const renderStepHeading = (title, description, stepKey = currentStep?.key) => (
    <header
      ref={registerStepHeading(stepKey)}
      tabIndex={-1}
      className="space-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
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

  const reviewChecklistItems = useMemo(() => {
    const marginNumber = Number(formState.margin);
    const hasMarginValue = formState.margin !== '' && formState.margin !== null && formState.margin !== undefined;
    const isMarginValid = Number.isFinite(marginNumber) && marginNumber > 0;

    const items = [];

    const instanceMessage = stepValidation.instance
      ? 'Instância conectada'
      : !formState.instanceId
        ? 'Selecione uma instância na Etapa 1'
        : 'Conecte a instância escolhida na Etapa 1';
    const instanceTooltip = stepValidation.instance
      ? 'Instância pronta para receber leads.'
      : !formState.instanceId
        ? 'Escolha uma instância para liberar Origem.'
        : 'Instância precisa estar conectada.';

    items.push({
      key: 'instance',
      isValid: stepValidation.instance,
      message: instanceMessage,
      helper: selectedInstance ? formatInstanceLabel(selectedInstance) : 'Ir para Instância',
      tooltip: instanceTooltip,
      stepIndex: stepIndexLookup.instance ?? 0,
    });

    const agreementMessage = stepValidation.agreement ? 'Origem válida' : 'Selecione o convênio na Etapa 2';
    const agreementTooltip = stepValidation.agreement
      ? 'Convênio selecionado para a campanha.'
      : 'Defina o convênio para liberar Produto & margem.';

    items.push({
      key: 'agreement',
      isValid: stepValidation.agreement,
      message: agreementMessage,
      helper: selectedAgreement ? formatAgreementLabel(selectedAgreement) : 'Ir para Origem',
      tooltip: agreementTooltip,
      stepIndex: stepIndexLookup.agreement ?? 1,
    });

    let productMessage = 'Produto compatível';
    let productTooltip = 'Produto e margem validados.';
    if (!stepValidation.product) {
      if (!formState.product) {
        productMessage = 'Escolha o produto na Etapa 3';
        productTooltip = 'Selecione um produto compatível para seguir.';
      } else if (!hasMarginValue) {
        productMessage = 'Adicione margem na Etapa 3';
        productTooltip = 'Informe a margem alvo para validar a combinação.';
      } else if (!isMarginValid) {
        productMessage = 'Use margem maior que zero na Etapa 3';
        productTooltip = 'Margem deve ser numérica e positiva.';
      } else {
        productMessage = 'Revise produto e margem na Etapa 3';
        productTooltip = 'Confirme os dados financeiros.';
      }
    }

    items.push({
      key: 'product',
      isValid: stepValidation.product,
      message: productMessage,
      helper: selectedProduct?.label
        ? `${selectedProduct.label}${formState.margin ? ` • ${formState.margin}%` : ''}`
        : 'Ir para Produto & margem',
      tooltip: productTooltip,
      stepIndex: stepIndexLookup.product ?? 2,
    });

    const strategyMessage = stepValidation.strategy ? 'Estratégia definida' : 'Selecione a régua na Etapa 4';
    const strategyTooltip = stepValidation.strategy
      ? 'Régua configurada para os leads.'
      : 'Escolha a estratégia antes de criar.';

    items.push({
      key: 'strategy',
      isValid: stepValidation.strategy,
      message: strategyMessage,
      helper: selectedStrategyCard?.cadence || selectedStrategy?.label || 'Ir para Estratégia',
      tooltip: strategyTooltip,
      stepIndex: stepIndexLookup.strategy ?? 3,
    });

    return items;
  }, [
    formState.agreementId,
    formState.instanceId,
    formState.margin,
    formState.product,
    formState.strategy,
    selectedAgreement,
    selectedInstance,
    selectedProduct,
    selectedStrategy,
    selectedStrategyCard,
    stepIndexLookup,
    stepValidation.agreement,
    stepValidation.instance,
    stepValidation.product,
    stepValidation.strategy,
  ]);

  const renderStepContent = () => {
    switch (currentStep?.key) {
      case 'instance': {
        const isConnected = Boolean(selectedInstance?.connected);
        return (
          <div className="space-y-6">
            {renderStepHeading('Escolha a instância', 'Use um número conectado para receber os leads.')}
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              {tenantContextLabel ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 px-2 py-0.5 text-primary">
                    Tenant · {tenantContextLabel}
                  </Badge>
                  <span>Mostrando apenas instâncias vinculadas a este tenant.</span>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border/70 bg-muted/10 p-3">
                  Vincule um convênio com tenant definido para liberar instâncias específicas.
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 min-w-0">
                <Label htmlFor="campaign-instance">Instância</Label>
                <Select value={formState.instanceId} onValueChange={handleInstanceChange}>
                  <SelectTrigger id="campaign-instance">
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((instance) => (
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
            {!isConnected && selectedInstance ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Conecte para liberar Origem</p>
                    <p className="text-sm leading-5 text-muted-foreground">
                      Gere o QR Code para ativar a instância e liberar a próxima etapa.
                    </p>
                    <Button variant="link" asChild size="sm" className="px-0 text-primary hover:text-primary">
                      <Link to="/ajuda">Precisa de ajuda?</Link>
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <Button onClick={() => selectedInstance?.onGenerateQr?.()}>Gerar QR agora</Button>
                  </div>
                </div>
              </div>
            ) : null}
            {!hasInstances ? (
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground">
                {tenantContextLabel
                  ? `Nenhuma instância do tenant ${tenantContextLabel} foi encontrada. Gere ou conecte uma instância para liberar as próximas etapas.`
                  : 'Nenhuma instância encontrada. Gere um QR para conectar e liberar as próximas etapas.'}
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
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="campaign-agreement">Convênio</Label>
                    {agreementsLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </div>
                    ) : (
                      <Popover open={isAgreementPickerOpen} onOpenChange={setIsAgreementPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={isAgreementPickerOpen}
                            className="w-full justify-between"
                            id="campaign-agreement"
                          >
                            <span className="flex min-w-0 items-center gap-2 truncate">
                              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
                              <span className="truncate">
                                {formState.agreementId && selectedAgreement
                                  ? formatAgreementLabel(selectedAgreement)
                                  : 'Selecione o convênio'}
                              </span>
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[360px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar convênio..." />
                            <CommandList>
                              <CommandEmpty>Nenhum convênio encontrado.</CommandEmpty>
                              <CommandGroup>
                                {agreementsList.map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={`${formatAgreementLabel(item)} ${item.region ?? ''} ${item.id}`}
                                    keywords={[item.region, item.id].filter(Boolean)}
                                    onSelect={() => {
                                      handleAgreementChange(item.id);
                                      setIsAgreementPickerOpen(false);
                                    }}
                                  >
                                    <div className="flex min-w-0 flex-col gap-0.5 truncate">
                                      <span className="truncate text-sm font-medium leading-5">
                                        {formatAgreementLabel(item)}
                                      </span>
                                      {item.region ? (
                                        <span className="text-xs leading-4 text-muted-foreground">{item.region}</span>
                                      ) : null}
                                    </div>
                                    <Check
                                      className={cn(
                                        'ml-auto h-4 w-4',
                                        formState.agreementId === item.id ? 'text-primary opacity-100' : 'opacity-0',
                                      )}
                                    />
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  <div className="space-y-2 min-w-0">
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
                {agreementErrorMessage ? (
                  <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
                    <AlertCircle className="h-4 w-4" aria-hidden />
                    <AlertTitle>Falha ao carregar convênios</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p className="leading-5">{agreementErrorMessage}</p>
                      <Button type="button" size="sm" variant="outline" onClick={retry}>
                        Tentar novamente
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}
                {agreementsList.length === 0 && !agreementsLoading ? (
                  <div className="space-y-3 rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground">
                    <div className="flex items-start gap-3">
                      <Plug className="h-4 w-4 text-muted-foreground" aria-hidden />
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Nenhum convênio disponível para a instância atual.</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Configure ou sincronize novos convênios para liberar esta etapa.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link to="/settings">Abrir Configurações</Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={retry}>
                        Recarregar convênios
                      </Button>
                    </div>
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                            <Badge
                              key={rule}
                              variant="status"
                              tone="info"
                              className="text-xs leading-4"
                            >
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
                          <Badge variant="status" tone="info" className="text-xs leading-4">
                            {card.cadence}
                          </Badge>
                          {card.compliance ? (
                            <Badge variant="status" tone="warning" className="text-xs leading-4">
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
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm leading-5 text-emerald-100">
              <p className="font-semibold text-emerald-50">Passo {finalStepNumber} (Inbox) preparado</p>
              <p className="mt-1 text-xs text-emerald-100/80">
                Assim que esta campanha for criada, os leads qualificados seguirão para a Inbox com esta mesma configuração.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="border-emerald-200/60 text-emerald-900">
                  <Link to="/whatsapp/inbox">Ir para a Inbox</Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-emerald-50 hover:bg-emerald-500/20"
                  onClick={() => goToStep(0)}
                >
                  Conferir instância
                </Button>
              </div>
            </div>
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
                {reviewChecklistItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => goToStep(item.stepIndex)}
                    className={cn(
                      'group flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      item.isValid
                        ? 'border-emerald-300/60 bg-emerald-500/5 hover:border-emerald-300/80'
                        : 'border-border hover:border-primary/50 hover:bg-primary/5',
                    )}
                  >
                    <Tooltip delayDuration={80}>
                      <TooltipTrigger asChild>
                        <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background">
                          {item.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500" aria-hidden />
                          )}
                          <span className="sr-only">{item.tooltip}</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {item.tooltip}
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium leading-5 text-foreground">{item.message}</span>
                      {item.helper ? (
                        <span className="text-xs leading-4 text-muted-foreground">{item.helper}</span>
                      ) : null}
                    </div>
                    <span className="ml-auto text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground/80">
                      Etapa {item.stepIndex + 1}
                    </span>
                  </button>
                ))}
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

  const totalSteps = TOTAL_STEPS;
  const currentStepNumber = Math.min(stepIndex + 1, totalSteps);
  const finalStepNumber = totalSteps;
  const isLastStep = stepIndex === totalSteps - 1;
  const advanceDisabledReason =
    currentStep?.key === 'instance' && selectedInstance && !selectedInstance.connected
      ? 'Conecte para liberar Origem.'
      : null;
  const isAdvanceDisabled = Boolean(advanceDisabledReason) || isSubmitting;

  const instancePhoneLabel =
    selectedInstance?.phoneLabel || selectedInstance?.formattedPhone || selectedInstance?.phone || '—';
  const instanceStatusLabel = selectedInstance?.connected ? 'Saudável' : 'Conectar';
  const instanceStatusTone = selectedInstance?.connected
    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
    : 'bg-amber-500/10 text-amber-200 border border-amber-500/40';

  const CampaignSummary = () => {
    const summaryItems = [
      {
        label: 'Instância',
        value: formatInstanceLabel(selectedInstance) || 'Selecione uma instância',
        helper: selectedInstance ? (selectedInstance.connected ? 'Conectada' : 'Desconectada') : null,
      },
      {
        label: 'Origem',
        value: formatAgreementLabel(selectedAgreement) || 'Escolha um convênio',
        helper: formState.leadSource ? `Fonte: ${LEAD_SOURCE_LABELS[formState.leadSource] ?? '—'}` : null,
      },
      {
        label: 'Produto',
        value: selectedProduct?.label || 'Defina o produto',
        helper: formState.margin ? `Margem alvo: ${formState.margin}%` : null,
      },
      {
        label: 'Estratégia',
        value:
          selectedStrategy?.label || selectedStrategyCard?.title || 'Selecione a régua',
        helper: selectedStrategyCard?.cadence ?? null,
      },
      {
        label: 'Status inicial',
        value: STATUS_OPTIONS.find((option) => option.value === formState.status)?.label ?? 'Ativar imediatamente',
        helper: null,
      },
    ];

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-inner">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Passo {currentStepNumber} de {totalSteps}
          </p>
          <p className="text-sm font-semibold text-foreground">Campanhas & roteamento</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Depois de criar, você pode acompanhar os leads na Inbox (Passo {finalStepNumber}) sem perder o contexto.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3 w-full">
            <Link to="/whatsapp/inbox">Ir para a Inbox</Link>
          </Button>
        </div>
        <div className="rounded-2xl border border-border/80 bg-background/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo vivo</p>
          <dl className="mt-3 space-y-3 text-sm leading-5 text-muted-foreground">
            {summaryItems.map((item) => (
              <div key={item.label}>
                <dt className="text-[0.7rem] uppercase tracking-wide text-muted-foreground/80">{item.label}</dt>
                <dd className="text-foreground">{item.value}</dd>
                {item.helper ? <p className="text-[0.7rem] text-muted-foreground">{item.helper}</p> : null}
              </div>
            ))}
          </dl>
        </div>
        {selectedStrategyCard ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs leading-5 text-primary">
            <p className="text-sm font-semibold text-primary-foreground">Estratégia atual</p>
            <p className="mt-1 text-primary-foreground/80">
              {selectedStrategyCard.definition} • {selectedStrategyCard.cadence}
            </p>
            {selectedStrategyCard.compliance ? (
              <p className="mt-2 text-[0.7rem] text-amber-200">{selectedStrategyCard.compliance}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const StepperRail = () => (
    <div className="border-b border-border/70 bg-background/80 px-4 py-3 shadow-sm backdrop-blur">
      <ol className="grid w-full gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {STEP_SEQUENCE.map((step, index) => {
          const status = stepStatuses[step.key];
          const isActive = status === 'current';
          const isCompleted = status === 'completed';
          const isBlocked = status === 'blocked';
          return (
            <li
              key={step.key}
              className="flex flex-col items-stretch gap-2 xl:flex-row xl:items-center xl:gap-3"
            >
              <Tooltip delayDuration={120}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => goToStep(index)}
                    className={cn(
                      'flex w-full min-w-[180px] items-start gap-3 rounded-xl border px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
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
                  <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                    {getStepBlockedReason(step.key)}
                  </TooltipContent>
                ) : null}
              </Tooltip>
              {index < STEP_SEQUENCE.length - 1 ? (
                <>
                  <span className="mx-auto block h-6 w-px bg-border/50 sm:hidden" aria-hidden />
                  <span className="hidden h-px w-10 bg-border/60 xl:block" aria-hidden />
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-col lg:max-h-[78vh]">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur">
          <StepperRail />
        </div>
        <div className="flex flex-col gap-6 px-5 pb-24 pt-5 sm:px-8 lg:flex-row lg:items-start lg:gap-8 lg:pb-28">
          <section className="flex-1 min-w-0">
            <div className="mx-auto w-full max-w-3xl space-y-6">
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
          </section>
          <aside className="mt-4 shrink-0 lg:mt-0 lg:w-80">
            <CampaignSummary />
          </aside>
        </div>
        <footer className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-5 py-4 backdrop-blur sm:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
            <div className="flex flex-wrap items-center gap-3">
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
      </div>
    </div>
  );
};

export default CreateCampaignWizard;
export { STEP_SEQUENCE };
