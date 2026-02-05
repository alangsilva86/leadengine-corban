import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, CheckCircle2, ChevronsUpDown, Loader2, Lock, Phone, Plug, Search, Shapes, Sparkles, } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion.jsx';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, } from '@/components/ui/command.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import useMediaQuery from '@/hooks/use-media-query.js';
import { WHATSAPP_CAMPAIGN_PRODUCTS, findCampaignProduct, findCampaignStrategy, } from '@/features/whatsapp/utils/campaign-options.js';
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
const CreateCampaignWizard = ({ open, agreement, instances = [], defaultInstanceId, onSubmit, onCancel, onSubmittingChange, onStepChange, onSelectionChange, }) => {
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
    const isLg = useMediaQuery('(min-width: 1024px)');
    const tenantContextLabel = useMemo(() => resolveTenantDisplayName(agreement), [agreement]);
    useEffect(() => {
        onSubmittingChange?.(isSubmitting);
    }, [isSubmitting, onSubmittingChange]);
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
        const preferredInstance = selectPreferredInstance(instances, { preferredInstanceId: defaultInstanceId ?? null }) ??
            connectedList[0] ??
            instances[0] ??
            null;
        const isFirstOpen = !isModalSessionActiveRef.current;
        isModalSessionActiveRef.current = true;
        setFormState((prev) => {
            const nextState = {
                ...prev,
                instanceId: prev.instanceId && instances.some((item) => item?.id === prev.instanceId)
                    ? prev.instanceId
                    : preferredInstance?.id ?? '',
                leadSource: prev.leadSource ?? (LEAD_SOURCE_OPTIONS[0]?.value ?? 'inbound'),
                segments: Array.isArray(prev.segments) ? prev.segments : [],
            };
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
        defaultInstanceId,
    ]);
    const currentStep = STEP_SEQUENCE[stepIndex];
    const selectedInstance = instances.find((item) => item?.id === formState.instanceId) ?? null;
    const selectedProduct = findCampaignProduct(formState.product);
    const selectedStrategy = findCampaignStrategy(formState.strategy);
    const selectedStrategyCard = STRATEGY_CARDS.find((card) => card.value === formState.strategy) ?? null;
    useEffect(() => {
        onSelectionChange?.({
            instance: selectedInstance,
            agreement: null,
            product: selectedProduct,
            strategy: selectedStrategy,
        });
    }, [onSelectionChange, selectedInstance, selectedProduct, selectedStrategy]);
    const suggestedCampaignName = useMemo(() => {
        const agreementLabel = formState.agreementName || formState.agreementId;
        const productLabel = selectedProduct?.label ?? '';
        const instanceLabel = formatInstanceLabel(selectedInstance);
        return buildSuggestedName({ agreementLabel, productLabel, instanceLabel });
    }, [selectedProduct, selectedInstance, formState.agreementId, formState.agreementName]);
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
    const stepValidation = useMemo(() => ({
        instance: Boolean(selectedInstance?.id) && Boolean(selectedInstance?.connected),
        agreement: Boolean(formState.agreementId),
        product: Boolean(formState.product) && Number(formState.margin) > 0,
        strategy: Boolean(formState.strategy),
        review: Boolean(formState.name?.trim()) && Boolean(formState.status),
    }), [selectedInstance, formState.agreementId, formState.product, formState.margin, formState.strategy, formState.name, formState.status]);
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
    const handleAgreementIdChange = (event) => {
        const value = event.target.value ?? '';
        setFormState((prev) => ({ ...prev, agreementId: value }));
    };
    const handleAgreementNameChange = (event) => {
        const value = event.target.value ?? '';
        setFormState((prev) => ({ ...prev, agreementName: value }));
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
            const normalizedSegments = Array.from(new Set((Array.isArray(formState.segments) ? formState.segments : [])
                .map((segment) => (typeof segment === 'string' ? segment.trim() : ''))
                .filter(Boolean)));
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Não foi possível criar a campanha.';
            setSubmitError(message);
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const registerStepHeading = (stepKey) => (node) => {
        if (node) {
            stepHeadingRefs.current[stepKey] = node;
        }
        else {
            delete stepHeadingRefs.current[stepKey];
        }
    };
    const renderStepHeading = (title, description, stepKey = currentStep?.key) => (_jsxs("header", { ref: registerStepHeading(stepKey), tabIndex: -1, className: "space-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", children: [_jsx("h2", { className: "text-base font-semibold leading-6 text-foreground md:text-lg", children: title }), description ? _jsx("p", { className: "text-sm leading-5 text-muted-foreground", children: description }) : null] }));
    const renderDependencyBadge = (label) => (_jsx(Badge, { variant: "status", tone: "info", className: "text-[0.7rem]", children: label }));
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
            }
            else if (!hasMarginValue) {
                productMessage = 'Adicione margem na Etapa 3';
                productTooltip = 'Informe a margem alvo para validar a combinação.';
            }
            else if (!isMarginValid) {
                productMessage = 'Use margem maior que zero na Etapa 3';
                productTooltip = 'Margem deve ser numérica e positiva.';
            }
            else {
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
                return (_jsxs("div", { className: "space-y-6", children: [renderStepHeading('Escolha a instância', 'Use um número conectado para receber os leads.'), _jsx("div", { className: "flex flex-col gap-2 text-xs text-muted-foreground", children: tenantContextLabel ? (_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Badge, { variant: "outline", className: "border-primary/40 bg-primary/10 px-2 py-0.5 text-primary", children: ["Tenant \u00B7 ", tenantContextLabel] }), _jsx("span", { children: "Mostrando apenas inst\u00E2ncias vinculadas a este tenant." })] })) : (_jsx("div", { className: "rounded-md border border-dashed border-border/70 bg-muted/10 p-3", children: "Vincule um conv\u00EAnio com tenant definido para liberar inst\u00E2ncias espec\u00EDficas." })) }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2 min-w-0", children: [_jsx(Label, { htmlFor: "campaign-instance", children: "Inst\u00E2ncia" }), _jsxs(Select, { value: formState.instanceId, onValueChange: handleInstanceChange, children: [_jsx(SelectTrigger, { id: "campaign-instance", children: _jsx(SelectValue, { placeholder: "Selecione a inst\u00E2ncia" }) }), _jsx(SelectContent, { children: instances.map((instance) => (_jsx(SelectItem, { value: instance.id, children: _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-sm font-medium leading-5", children: formatInstanceLabel(instance) }), _jsx("span", { className: "text-xs leading-4 text-muted-foreground", children: instance.connected ? 'Conectada e pronta para receber leads.' : 'Desconectada — conecte para liberar Origem.' })] }) }, instance.id ?? formatInstanceLabel(instance)))) })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Badge, { variant: "status", tone: isConnected ? 'success' : 'warning', children: isConnected ? 'Conectada' : 'Desconectada' }), !isConnected && formState.instanceId ? (_jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => selectedInstance?.onGenerateQr?.(), children: "Gerar QR" })) : null] }), _jsx("p", { className: "text-xs leading-5 text-muted-foreground", children: isConnected ? 'Pronta para receber leads.' : 'Conecte para liberar Origem.' })] })] }), !isConnected && selectedInstance ? (_jsx("div", { className: "rounded-xl border border-primary/30 bg-primary/5 p-4", children: _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: "Conecte para liberar Origem" }), _jsx("p", { className: "text-sm leading-5 text-muted-foreground", children: "Gere o QR Code para ativar a inst\u00E2ncia e liberar a pr\u00F3xima etapa." }), _jsx(Button, { variant: "link", asChild: true, size: "sm", className: "px-0 text-primary hover:text-primary", children: _jsx(Link, { to: "/ajuda", children: "Precisa de ajuda?" }) })] }), _jsx("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3", children: _jsx(Button, { onClick: () => selectedInstance?.onGenerateQr?.(), children: "Gerar QR agora" }) })] }) })) : null, !hasInstances ? (_jsx("div", { className: "rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground", children: tenantContextLabel
                                ? `Nenhuma instância do tenant ${tenantContextLabel} foi encontrada. Gere ou conecte uma instância para liberar as próximas etapas.`
                                : 'Nenhuma instância encontrada. Gere um QR para conectar e liberar as próximas etapas.' })) : null, hasInstances && !hasConnectedInstances ? (_jsx("div", { className: "rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-800", children: "Voc\u00EA possui inst\u00E2ncias cadastradas, mas nenhuma conectada no momento." })) : null] }));
            }
            case 'agreement': {
                return (_jsxs("div", { className: "space-y-6", children: [renderStepHeading('Defina a origem de leads', 'Informe o identificador usado para buscar leads na fonte.'), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2 min-w-0", children: [_jsx(Label, { htmlFor: "campaign-source-id", children: "Origem (sourceId)" }), _jsx(Input, { id: "campaign-source-id", value: formState.agreementId, onChange: handleAgreementIdChange, placeholder: "Ex.: inss, siape, fgts (ou o id interno)", required: true })] }), _jsxs("div", { className: "space-y-2 min-w-0", children: [_jsx(Label, { htmlFor: "campaign-source-name", children: "Origem (nome)" }), _jsx(Input, { id: "campaign-source-name", value: formState.agreementName, onChange: handleAgreementNameChange, placeholder: "Ex.: INSS, SIAPE, FGTS" })] })] })] }));
            }
            case 'product': {
                return (_jsxs("div", { className: "space-y-6", children: [renderStepHeading('Escolha o produto e a margem', 'Opções válidas para o convênio.'), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_200px]", children: [_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3", children: WHATSAPP_CAMPAIGN_PRODUCTS.map((option) => {
                                                const isSelected = formState.product === option.value;
                                                const rules = PRODUCT_RULES[option.value] ?? [];
                                                const card = (_jsxs("button", { type: "button", onClick: () => {
                                                        handleProductChange(option.value);
                                                    }, "aria-pressed": isSelected, className: cn('h-full rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', isSelected
                                                        ? 'border-primary bg-primary/10 shadow-sm'
                                                        : 'border-border hover:border-primary/40'), children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold leading-5", children: option.label }), _jsx("p", { className: "text-xs leading-4 text-muted-foreground", children: option.description })] }), isSelected ? _jsx(CheckCircle2, { className: "h-4 w-4 text-primary" }) : null] }), _jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: rules.map((rule) => (_jsx(Badge, { variant: "status", tone: "info", className: "text-xs leading-4", children: rule }, rule))) })] }));
                                                return (_jsx("div", { className: "h-full", children: card }, option.value));
                                            }) }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2 md:col-span-1", children: [_jsx(Label, { htmlFor: "campaign-margin", children: "Margem alvo (%)" }), _jsx(Input, { id: "campaign-margin", inputMode: "decimal", value: formState.margin, onChange: (event) => handleMarginChange(event.target.value), placeholder: "1,5" })] }), _jsx("div", { className: "hidden md:block", "aria-hidden": true, children: _jsx("div", { className: "rounded-md border border-dashed border-border/70 bg-muted/10 p-3 text-xs leading-5 text-muted-foreground", children: "Use porcentagem para alinhar metas financeiras e liberar combina\u00E7\u00F5es." }) })] }), renderDependencyBadge('Combinações seguem o convênio escolhido')] }), _jsx("aside", { className: "rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground", children: "Sua escolha sugere a estrat\u00E9gia na pr\u00F3xima etapa." })] })] }));
            }
            case 'strategy': {
                return (_jsxs("div", { className: "space-y-6", children: [renderStepHeading('Selecione a estratégia', 'Régua conforme o perfil do lead.'), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_200px]", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "grid gap-3 md:grid-cols-3", children: STRATEGY_CARDS.map((card) => {
                                                const isSelected = formState.strategy === card.value;
                                                const content = (_jsxs("button", { type: "button", onClick: () => handleStrategyChange(card.value), "aria-pressed": isSelected, className: cn('rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', isSelected
                                                        ? 'border-primary bg-primary/10 shadow-sm'
                                                        : 'border-border hover:border-primary/40'), children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "text-sm font-semibold leading-5", children: card.title }), isSelected ? _jsx(CheckCircle2, { className: "h-4 w-4 text-primary" }) : null] }), _jsx("p", { className: "mt-2 text-xs leading-4 text-muted-foreground", children: card.definition }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [_jsx(Badge, { variant: "status", tone: "info", className: "text-xs leading-4", children: card.cadence }), card.compliance ? (_jsx(Badge, { variant: "status", tone: "warning", className: "text-xs leading-4", children: card.compliance })) : null] })] }, card.value));
                                                return content;
                                            }) }), renderDependencyBadge('Sugestão automática baseada em Produto & margem')] }), _jsx("aside", { className: "rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-5 text-muted-foreground", children: "Voc\u00EA pode trocar depois na edi\u00E7\u00E3o da campanha." })] })] }));
            }
            case 'review': {
                return (_jsxs("div", { className: "space-y-6", children: [renderStepHeading('Revise e crie a campanha', null), _jsxs("div", { className: "rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm leading-5 text-emerald-100", children: [_jsxs("p", { className: "font-semibold text-emerald-50", children: ["Passo ", finalStepNumber, " (Inbox) preparado"] }), _jsx("p", { className: "mt-1 text-xs text-emerald-100/80", children: "Assim que esta campanha for criada, os leads qualificados seguir\u00E3o para a Inbox com esta mesma configura\u00E7\u00E3o." }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [_jsx(Button, { asChild: true, size: "sm", variant: "outline", className: "border-emerald-200/60 text-emerald-900", children: _jsx(Link, { to: "/whatsapp/inbox", children: "Ir para a Inbox" }) }), _jsx(Button, { type: "button", size: "sm", variant: "ghost", className: "text-emerald-50 hover:bg-emerald-500/20", onClick: () => goToStep(0), children: "Conferir inst\u00E2ncia" })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-3", children: [_jsxs("div", { className: "flex items-center gap-3 rounded-lg border border-border p-3", children: [_jsx(Phone, { className: "h-4 w-4 text-muted-foreground" }), _jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm font-medium leading-5", children: "Inst\u00E2ncia" }), _jsx("span", { className: "text-sm leading-5 text-muted-foreground", children: selectedInstance ? `${formatInstanceLabel(selectedInstance)} • ${selectedInstance.connected ? 'Conectada' : 'Desconectada'}` : '—' })] })] }), _jsxs("div", { className: "flex items-center gap-3 rounded-lg border border-border p-3", children: [_jsx(Plug, { className: "h-4 w-4 text-muted-foreground" }), _jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm font-medium leading-5", children: "Origem" }), _jsxs("span", { className: "text-sm leading-5 text-muted-foreground", children: [formState.agreementName || formState.agreementId || '—', formState.leadSource ? ` · Fonte: ${LEAD_SOURCE_LABELS[formState.leadSource] ?? '—'}` : ''] })] })] }), _jsxs("div", { className: "flex items-center gap-3 rounded-lg border border-border p-3", children: [_jsx(Shapes, { className: "h-4 w-4 text-muted-foreground" }), _jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm font-medium leading-5", children: "Produto & margem" }), _jsxs("span", { className: "text-sm leading-5 text-muted-foreground", children: [selectedProduct ? selectedProduct.label : '—', formState.margin ? ` · até ${formState.margin}%` : ''] })] })] }), _jsxs("div", { className: "flex items-center gap-3 rounded-lg border border-border p-3", children: [_jsx(Sparkles, { className: "h-4 w-4 text-muted-foreground" }), _jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm font-medium leading-5", children: "Estrat\u00E9gia" }), _jsx("span", { className: "text-sm leading-5 text-muted-foreground", children: selectedStrategyCard ? `${selectedStrategyCard.title} · ${selectedStrategyCard.cadence}` : selectedStrategy?.label ?? '—' })] })] })] }), _jsx("div", { className: "grid gap-2", children: reviewChecklistItems.map((item) => (_jsxs("button", { type: "button", onClick: () => goToStep(item.stepIndex), className: cn('group flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', item.isValid
                                            ? 'border-emerald-300/60 bg-emerald-500/5 hover:border-emerald-300/80'
                                            : 'border-border hover:border-primary/50 hover:bg-primary/5'), children: [_jsxs(Tooltip, { delayDuration: 80, children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs("span", { className: "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background", children: [item.isValid ? (_jsx(CheckCircle2, { className: "h-4 w-4 text-emerald-500", "aria-hidden": true })) : (_jsx(AlertCircle, { className: "h-4 w-4 text-amber-500", "aria-hidden": true })), _jsx("span", { className: "sr-only", children: item.tooltip })] }) }), _jsx(TooltipContent, { side: "top", className: "text-xs", children: item.tooltip })] }), _jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsx("span", { className: "text-sm font-medium leading-5 text-foreground", children: item.message }), item.helper ? (_jsx("span", { className: "text-xs leading-4 text-muted-foreground", children: item.helper })) : null] }), _jsxs("span", { className: "ml-auto text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground/80", children: ["Etapa ", item.stepIndex + 1] })] }, item.key))) }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "campaign-name", children: "Nome da campanha" }), _jsx(Input, { id: "campaign-name", value: formState.name, onChange: handleNameChange, placeholder: "Cart\u00E3o benef\u00EDcio \u2022 SAEC Goi\u00E2nia" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "campaign-status-review", children: "Status inicial" }), _jsxs(Select, { value: formState.status, onValueChange: handleStatusChange, children: [_jsx(SelectTrigger, { id: "campaign-status-review", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: STATUS_OPTIONS.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] })] })] })] })] }));
            }
            default:
                return null;
        }
    };
    const totalSteps = TOTAL_STEPS;
    const currentStepNumber = Math.min(stepIndex + 1, totalSteps);
    const finalStepNumber = totalSteps;
    const isLastStep = stepIndex === totalSteps - 1;
    const advanceDisabledReason = currentStep?.key === 'instance' && selectedInstance && !selectedInstance.connected
        ? 'Conecte para liberar Origem.'
        : null;
    const isAdvanceDisabled = Boolean(advanceDisabledReason) || isSubmitting;
    const instancePhoneLabel = selectedInstance?.phoneLabel || selectedInstance?.formattedPhone || selectedInstance?.phone || '—';
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
                value: selectedStrategy?.label || selectedStrategyCard?.title || 'Selecione a régua',
                helper: selectedStrategyCard?.cadence ?? null,
            },
            {
                label: 'Status inicial',
                value: STATUS_OPTIONS.find((option) => option.value === formState.status)?.label ?? 'Ativar imediatamente',
                helper: null,
            },
        ];
        return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-inner", children: [_jsxs("p", { className: "text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground", children: ["Passo ", currentStepNumber, " de ", totalSteps] }), _jsx("p", { className: "text-sm font-semibold text-foreground", children: "Campanhas & roteamento" }), _jsxs("p", { className: "mt-1 text-xs leading-5 text-muted-foreground", children: ["Depois de criar, voc\u00EA pode acompanhar os leads na Inbox (Passo ", finalStepNumber, ") sem perder o contexto."] }), _jsx(Button, { asChild: true, variant: "outline", size: "sm", className: "mt-3 w-full", children: _jsx(Link, { to: "/whatsapp/inbox", children: "Ir para a Inbox" }) })] }), _jsxs("div", { className: "rounded-2xl border border-border/80 bg-background/60 p-4 shadow-sm", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Resumo vivo" }), _jsx("dl", { className: "mt-3 space-y-3 text-sm leading-5 text-muted-foreground", children: summaryItems.map((item) => (_jsxs("div", { children: [_jsx("dt", { className: "text-[0.7rem] uppercase tracking-wide text-muted-foreground/80", children: item.label }), _jsx("dd", { className: "text-foreground", children: item.value }), item.helper ? _jsx("p", { className: "text-[0.7rem] text-muted-foreground", children: item.helper }) : null] }, item.label))) })] }), selectedStrategyCard ? (_jsxs("div", { className: "rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs leading-5 text-primary", children: [_jsx("p", { className: "text-sm font-semibold text-primary-foreground", children: "Estrat\u00E9gia atual" }), _jsxs("p", { className: "mt-1 text-primary-foreground/80", children: [selectedStrategyCard.definition, " \u2022 ", selectedStrategyCard.cadence] }), selectedStrategyCard.compliance ? (_jsx("p", { className: "mt-2 text-[0.7rem] text-amber-200", children: selectedStrategyCard.compliance })) : null] })) : null] }));
    };
    const StepperRail = () => (_jsx("div", { className: "border-b border-border/70 bg-background/80 px-4 py-3 shadow-sm backdrop-blur", children: _jsx("ol", { className: "grid w-full gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5", children: STEP_SEQUENCE.map((step, index) => {
                const status = stepStatuses[step.key];
                const isActive = status === 'current';
                const isCompleted = status === 'completed';
                const isBlocked = status === 'blocked';
                return (_jsxs("li", { className: "flex flex-col items-stretch gap-2 xl:flex-row xl:items-center xl:gap-3", children: [_jsxs(Tooltip, { delayDuration: 120, children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs("button", { type: "button", onClick: () => goToStep(index), className: cn('flex w-full min-w-[180px] items-start gap-3 rounded-xl border px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', isActive
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border/70 hover:border-primary/40', isBlocked && 'cursor-not-allowed opacity-60 hover:border-border/70'), "aria-current": isActive ? 'step' : undefined, "aria-disabled": isBlocked, children: [_jsx("span", { className: cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', isCompleted
                                                    ? 'bg-emerald-500/15 text-emerald-600'
                                                    : isActive
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-border text-muted-foreground'), children: isCompleted ? _jsx(CheckCircle2, { className: "h-4 w-4" }) : index + 1 }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold leading-4 text-foreground", children: step.title }), _jsx("p", { className: "text-[0.7rem] leading-4 text-muted-foreground", children: step.description })] }), isBlocked ? _jsx(Lock, { className: "ml-auto h-4 w-4 text-muted-foreground" }) : null] }) }), isBlocked ? (_jsx(TooltipContent, { side: "bottom", className: "max-w-[220px] text-xs", children: getStepBlockedReason(step.key) })) : null] }), index < STEP_SEQUENCE.length - 1 ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "mx-auto block h-6 w-px bg-border/50 sm:hidden", "aria-hidden": true }), _jsx("span", { className: "hidden h-px w-10 bg-border/60 xl:block", "aria-hidden": true })] })) : null] }, step.key));
            }) }) }));
    return (_jsx("div", { className: "flex min-h-0 flex-col lg:max-h-[78vh]", children: _jsxs("div", { className: "flex min-h-0 flex-1 flex-col overflow-y-auto", children: [_jsx("div", { className: "sticky top-0 z-20 bg-background/95 backdrop-blur", children: _jsx(StepperRail, {}) }), _jsxs("div", { className: "flex flex-col gap-6 px-5 pb-24 pt-5 sm:px-8 lg:flex-row lg:items-start lg:gap-8 lg:pb-28", children: [_jsx("section", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "mx-auto w-full max-w-3xl space-y-6", children: [renderStepContent(), stepError ? (_jsxs("div", { className: "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm leading-5 text-destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx("span", { children: stepError })] })) : null, submitError ? (_jsxs("div", { className: "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm leading-5 text-destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx("span", { children: submitError })] })) : null] }) }), _jsx("aside", { className: "mt-4 shrink-0 lg:mt-0 lg:w-80", children: _jsx(CampaignSummary, {}) })] }), _jsx("footer", { className: "sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-5 py-4 backdrop-blur sm:px-8", children: _jsxs("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: onCancel, disabled: isSubmitting, children: "Cancelar" }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: goToPreviousStep, disabled: stepIndex === 0 || isSubmitting, children: "Voltar" }), isLastStep ? (_jsxs(Button, { type: "button", onClick: handleSubmit, disabled: isSubmitting, children: [isSubmitting ? _jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }) : null, isSubmitting ? 'Criando…' : 'Criar campanha'] })) : (_jsxs(Tooltip, { delayDuration: 120, children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { children: _jsx(Button, { type: "button", onClick: goToNextStep, disabled: isAdvanceDisabled, children: "Avan\u00E7ar" }) }) }), advanceDisabledReason ? (_jsx(TooltipContent, { side: "top", className: "max-w-[200px] text-xs", children: advanceDisabledReason })) : null] }))] })] }) })] }) }));
};
export default CreateCampaignWizard;
export { STEP_SEQUENCE };
