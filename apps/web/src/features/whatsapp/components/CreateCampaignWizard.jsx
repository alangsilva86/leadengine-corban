import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

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
import { Separator } from '@/components/ui/separator.jsx';
import useAgreements from '@/features/agreements/useAgreements.js';
import {
  WHATSAPP_CAMPAIGN_PRODUCTS,
  WHATSAPP_CAMPAIGN_STRATEGIES,
  findCampaignProduct,
  findCampaignStrategy,
} from '@/features/whatsapp/utils/campaign-options.js';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativar imediatamente' },
  { value: 'paused', label: 'Criar pausada' },
  { value: 'draft', label: 'Salvar como rascunho' },
];

const STEP_SEQUENCE = [
  { key: 'instance', title: 'Instância', description: 'Escolha a instância conectada que receberá os leads.' },
  {
    key: 'agreement',
    title: 'Origem dos leads',
    description: 'Selecione o convênio, parceiro ou carteira que identifica a origem dos leads.',
  },
  {
    key: 'product',
    title: 'Produto e margem',
    description: 'Informe o produto trabalhado e a margem desejada para calibrar metas.',
  },
  { key: 'strategy', title: 'Estratégia', description: 'Selecione a estratégia operacional da campanha.' },
  { key: 'review', title: 'Revisão', description: 'Revise as informações antes de criar a campanha.' },
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

const CreateCampaignWizard = ({
  open,
  agreement,
  instances = [],
  defaultInstanceId,
  onSubmit,
  onCancel,
  onSubmittingChange,
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

  useEffect(() => {
    if (!open) {
      return;
    }

    const preferredInstance =
      sortedInstances.find((item) => item?.id === defaultInstanceId) ?? connectedInstances[0] ?? sortedInstances[0] ?? null;

    const preferredAgreementId = agreement?.id ?? '';
    const preferredAgreementName = agreement?.name ?? agreement?.displayName ?? '';
    const productLabel = findCampaignProduct(formState.product)?.label ?? '';

    setFormState((prev) => ({
      ...prev,
      instanceId: preferredInstance?.id ?? '',
      agreementId: preferredAgreementId,
      agreementName: preferredAgreementName,
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
  }, [open, agreement?.id, agreement?.name, agreement?.displayName, sortedInstances, connectedInstances, defaultInstanceId, nameDirty]);

  const currentStep = STEP_SEQUENCE[stepIndex];
  const selectedInstance = sortedInstances.find((item) => item?.id === formState.instanceId) ?? null;
  const selectedAgreement = agreements.find((item) => item?.id === formState.agreementId) ?? null;
  const selectedProduct = findCampaignProduct(formState.product);
  const selectedStrategy = findCampaignStrategy(formState.strategy);

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
  }, [open, selectedAgreement, selectedProduct, selectedInstance, nameDirty]);

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

  const handleNameChange = (event) => {
    setFormState((prev) => ({ ...prev, name: event.target.value }));
    setNameDirty(true);
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
          return 'Selecione a instância que será vinculada à campanha.';
        }
        if (selectedInstance && !selectedInstance.connected) {
          return 'A instância precisa estar conectada para receber leads.';
        }
        return null;
      case 'agreement':
        if (!formState.agreementId) {
          return 'Selecione a origem responsável pela campanha (convênio, parceiro ou carteira).';
        }
        return null;
      case 'product': {
        if (!formState.product) {
          return 'Escolha o produto principal desta campanha.';
        }
        const numericMargin = Number(formState.margin);
        if (!Number.isFinite(numericMargin) || numericMargin <= 0) {
          return 'Informe a margem desejada utilizando números positivos.';
        }
        return null;
      }
      case 'strategy':
        if (!formState.strategy) {
          return 'Selecione a estratégia operacional da campanha.';
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

  const renderStepContent = () => {
    switch (currentStep?.key) {
      case 'instance':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Instância conectada</Label>
              <Select value={formState.instanceId} onValueChange={handleInstanceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {sortedInstances.map((instance) => (
                    <SelectItem key={instance.id ?? formatInstanceLabel(instance)} value={instance.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{formatInstanceLabel(instance)}</span>
                        <span className="text-xs text-muted-foreground">
                          {instance.connected ? 'Conectada' : 'Desconectada'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Apenas instâncias conectadas entregam leads automaticamente. Selecione uma instância conectada para continuar.
              </p>
            </div>
          </div>
        );
      case 'agreement':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Convênio de origem</Label>
              <Select value={formState.agreementId} onValueChange={handleAgreementChange} disabled={agreementsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={agreementsLoading ? 'Carregando origens…' : 'Selecione a origem'} />
                </SelectTrigger>
                <SelectContent>
                  {agreements.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{formatAgreementLabel(item)}</span>
                        {item.region ? (
                          <span className="text-xs text-muted-foreground">{item.region}</span>
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agreementsError ? (
                <div className="text-xs text-destructive">
                  {agreementsError}{' '}
                  <button type="button" className="underline" onClick={retry}>
                    Tentar novamente
                  </button>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                A origem selecionada será usada para identificar os leads gerados por esta campanha.
              </p>
            </div>
          </div>
        );
      case 'product':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Produto principal</Label>
              <Select value={formState.product} onValueChange={handleProductChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o produto" />
                </SelectTrigger>
                <SelectContent>
                  {WHATSAPP_CAMPAIGN_PRODUCTS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-margin">Margem alvo (%)</Label>
              <Input
                id="campaign-margin"
                inputMode="decimal"
                value={formState.margin}
                onChange={(event) => handleMarginChange(event.target.value)}
                placeholder="1,5"
              />
              <p className="text-xs text-muted-foreground">
                A margem ajuda a calibrar metas de CPL e acompanhar a performance financeira da campanha.
              </p>
            </div>
          </div>
        );
      case 'strategy':
        return (
          <div className="space-y-4">
            <Label>Estratégia operacional</Label>
            <div className="grid gap-3 md:grid-cols-3">
              {WHATSAPP_CAMPAIGN_STRATEGIES.map((option) => {
                const isSelected = formState.strategy === option.value;
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => handleStrategyChange(option.value)}
                    className={`rounded-lg border p-4 text-left transition hover:border-primary/50 ${
                      isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary/40' : 'border-border/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{option.label}</span>
                      {isSelected ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 'review':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Nome da campanha</Label>
              <Input
                id="campaign-name"
                value={formState.name}
                onChange={handleNameChange}
                placeholder="Convênio • Produto • Instância"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status inicial</Label>
                <Select value={formState.status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
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

              <div className="space-y-2 text-sm">
                <Label>Resumo</Label>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    {formState.agreementName ? <Badge variant="secondary">{formState.agreementName}</Badge> : null}
                    {selectedProduct ? <Badge variant="outline">{selectedProduct.label}</Badge> : null}
                    {formState.margin ? (
                      <Badge variant="outline">Margem {Number(formState.margin).toFixed(2)}%</Badge>
                    ) : null}
                    {selectedStrategy ? <Badge variant="outline">{selectedStrategy.label}</Badge> : null}
                  </div>
                  <Separator className="my-2" />
                  <dl className="grid gap-1">
                    <div className="flex justify-between gap-2">
                      <dt className="font-medium text-foreground">Instância</dt>
                      <dd>{formatInstanceLabel(selectedInstance)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-medium text-foreground">Convênio</dt>
                      <dd>{formState.agreementName || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-medium text-foreground">Estratégia</dt>
                      <dd>{selectedStrategy?.label ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const showBackButton = stepIndex > 0;
  const isLastStep = stepIndex === STEP_SEQUENCE.length - 1;

  return (
    <div className="space-y-6">
      <ol className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-5">
        {STEP_SEQUENCE.map((step, index) => {
          const isActive = index === stepIndex;
          const isCompleted = index < stepIndex;
          return (
            <li
              key={step.key}
              className={`rounded-md border px-3 py-2 transition ${
                isActive ? 'border-primary bg-primary/10 text-primary-foreground' : 'border-border/60 bg-muted/20'
              } ${isCompleted ? 'opacity-80' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-border text-muted-foreground'
                }`}>
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">{step.title}</p>
                  <p className="text-[0.65rem] leading-snug">{step.description}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="space-y-4">{renderStepContent()}</div>

      {stepError ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{stepError}</span>
        </div>
      ) : null}

      {submitError ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{submitError}</span>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {showBackButton ? (
            <Button type="button" variant="ghost" size="sm" onClick={goToPreviousStep} disabled={isSubmitting}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isLastStep ? (
            <Button type="button" onClick={goToNextStep} disabled={isSubmitting}>
              Avançar
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Criando…' : 'Criar campanha'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateCampaignWizard;
