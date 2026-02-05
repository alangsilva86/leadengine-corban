import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChatCommandCenter } from '../ChatCommandCenter.jsx';
import useChatController from '../hooks/useChatController.js';
import useManualConversationFlow from '../hooks/useManualConversationFlow';
import useTicketFieldUpdaters from '../hooks/useTicketFieldUpdaters';
import useWhatsAppAvailability from '../hooks/useWhatsAppAvailability';
import emitInboxTelemetry from '../utils/telemetry.js';
import { WhatsAppInstancesProvider } from '@/features/whatsapp/hooks/useWhatsAppInstances.jsx';
import { getTenantId } from '@/lib/auth.js';
import { apiGet, apiPost } from '@/lib/api.js';
import LossReasonDialog from '../components/ConversationArea/LossReasonDialog.jsx';
import { LOSS_REASONS, LOSS_REASON_HELPERS } from '../components/ConversationArea/lossReasons.js';
const AI_MODE_VALUES = ['assist', 'auto', 'manual'];
const DEFAULT_AI_MODE = 'assist';
const isAiMode = (value) => typeof value === 'string' && AI_MODE_VALUES.includes(value);
const normalizeAiMode = (value) => {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'autonomous') {
        return 'auto';
    }
    if (isAiMode(normalized)) {
        return normalized;
    }
    return null;
};
const resolveTicketAiMode = (ticket) => {
    if (!ticket || typeof ticket !== 'object') {
        return null;
    }
    const candidates = [
        ticket?.automation?.mode,
        ticket?.metadata?.aiMode,
        ticket?.metadata?.automationMode,
        ticket?.aiMode,
    ];
    for (const candidate of candidates) {
        const normalized = normalizeAiMode(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return null;
};
const resolveTicketAiConfidence = (ticket) => {
    if (!ticket || typeof ticket !== 'object') {
        return null;
    }
    const candidates = [
        ticket?.automation?.confidence,
        ticket?.metadata?.aiConfidence,
        ticket?.metadata?.automationConfidence,
        ticket?.aiConfidence,
        ticket?.confidence,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            return candidate;
        }
    }
    return null;
};
const inferMessageTypeFromMime = (mimeType) => {
    if (typeof mimeType !== 'string') {
        return 'DOCUMENT';
    }
    const normalized = mimeType.toLowerCase();
    if (normalized.startsWith('image/')) {
        return 'IMAGE';
    }
    if (normalized.startsWith('video/')) {
        return 'VIDEO';
    }
    if (normalized.startsWith('audio/')) {
        return 'AUDIO';
    }
    return 'DOCUMENT';
};
const normalizeTicketString = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return null;
};
const resolveTicketMetadataField = (ticket, key) => {
    if (!ticket || typeof ticket !== 'object') {
        return null;
    }
    const metadata = ticket.metadata;
    if (!metadata || typeof metadata !== 'object') {
        return null;
    }
    return normalizeTicketString(metadata[key]);
};
const resolveTicketSourceInstance = (ticket) => {
    const metadataSource = resolveTicketMetadataField(ticket, 'sourceInstance');
    if (metadataSource) {
        return metadataSource;
    }
    const metadataInstance = resolveTicketMetadataField(ticket, 'instanceId');
    if (metadataInstance) {
        return metadataInstance;
    }
    return normalizeTicketString(ticket?.instanceId);
};
const resolveTicketCampaignId = (ticket) => {
    const metadataCampaignId = resolveTicketMetadataField(ticket, 'campaignId');
    if (metadataCampaignId) {
        return metadataCampaignId;
    }
    return normalizeTicketString(ticket?.lead?.campaignId);
};
const resolveTicketCampaignName = (ticket) => {
    const metadataCampaignName = resolveTicketMetadataField(ticket, 'campaignName');
    if (metadataCampaignName) {
        return metadataCampaignName;
    }
    const leadCampaignName = normalizeTicketString(ticket?.lead?.campaignName);
    if (leadCampaignName) {
        return leadCampaignName;
    }
    return normalizeTicketString(ticket?.lead?.campaign?.name);
};
const resolveTicketProductType = (ticket) => {
    return resolveTicketMetadataField(ticket, 'productType');
};
const resolveTicketStrategy = (ticket) => {
    return resolveTicketMetadataField(ticket, 'strategy');
};
const buildFilterOptions = (tickets) => {
    const instanceMap = new Map();
    const campaignMap = new Map();
    const productMap = new Map();
    const strategyMap = new Map();
    for (const ticket of tickets) {
        const instanceId = resolveTicketSourceInstance(ticket);
        if (instanceId) {
            const key = instanceId.toLowerCase();
            if (!instanceMap.has(key)) {
                instanceMap.set(key, instanceId);
            }
        }
        const campaignId = resolveTicketCampaignId(ticket);
        const campaignName = resolveTicketCampaignName(ticket);
        const campaignValue = campaignId ?? campaignName;
        if (campaignValue) {
            const key = campaignId ? `id:${campaignId.toLowerCase()}` : `name:${campaignValue.toLowerCase()}`;
            if (!campaignMap.has(key)) {
                const label = campaignName ?? campaignValue;
                campaignMap.set(key, { value: campaignId ?? campaignValue, label });
            }
        }
        const productType = resolveTicketProductType(ticket);
        if (productType) {
            const key = productType.toLowerCase();
            if (!productMap.has(key)) {
                productMap.set(key, productType);
            }
        }
        const strategy = resolveTicketStrategy(ticket);
        if (strategy) {
            const key = strategy.toLowerCase();
            if (!strategyMap.has(key)) {
                strategyMap.set(key, strategy);
            }
        }
    }
    const sortByLabel = (a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' });
    return {
        instanceOptions: Array.from(instanceMap.values())
            .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
            .map((value) => ({ value, label: value })),
        campaignOptions: Array.from(campaignMap.values()).sort(sortByLabel),
        productTypeOptions: Array.from(productMap.values())
            .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
            .map((value) => ({ value, label: value })),
        strategyOptions: Array.from(strategyMap.values())
            .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
            .map((value) => ({ value, label: value })),
    };
};
export const ChatCommandCenterContainer = ({ tenantId: tenantIdProp, currentUser }) => {
    const tenantId = tenantIdProp ?? getTenantId() ?? 'demo-tenant';
    const controller = useChatController({ tenantId, currentUser });
    const selectedTicket = controller.selectedTicket ?? null;
    const selectedContact = selectedTicket?.contact ?? null;
    const selectedLead = selectedTicket?.lead ?? null;
    const selectedTicketIdValue = selectedTicket?.id ?? controller.selectedTicketId ?? null;
    const selectedTicketKey = selectedTicketIdValue == null ? null : String(selectedTicketIdValue);
    const [isBulkLossDialogOpen, setBulkLossDialogOpen] = useState(false);
    const [isBulkLossSubmitting, setBulkLossSubmitting] = useState(false);
    const [globalAiMode, setGlobalAiMode] = useState(DEFAULT_AI_MODE);
    const [isAiModeReady, setIsAiModeReady] = useState(false);
    const [aiModesByTicket, setAiModesByTicket] = useState({});
    const [aiModesByQueue, setAiModesByQueue] = useState({});
    const selectedTicketQueueId = selectedTicket?.queueId ?? null;
    useEffect(() => {
        let isMounted = true;
        setIsAiModeReady(false);
        setAiModesByTicket((previous) => (Object.keys(previous).length > 0 ? {} : previous));
        setAiModesByQueue((previous) => (Object.keys(previous).length > 0 ? {} : previous));
        const loadAiMode = async () => {
            try {
                const response = await apiGet('/api/ai/mode');
                const payload = response;
                const fetchedMode = normalizeAiMode(payload?.mode) ?? normalizeAiMode(payload?.data?.mode);
                if (isMounted && fetchedMode) {
                    setGlobalAiMode(fetchedMode);
                }
                if (selectedTicketQueueId) {
                    try {
                        const queueResponse = await apiGet(`/api/ai/mode?queueId=${encodeURIComponent(selectedTicketQueueId)}`);
                        const queuePayload = queueResponse;
                        const queueMode = normalizeAiMode(queuePayload?.mode) ?? normalizeAiMode(queuePayload?.data?.mode);
                        if (isMounted && queueMode) {
                            setAiModesByQueue((prev) => prev[selectedTicketQueueId] === queueMode ? prev : { ...prev, [selectedTicketQueueId]: queueMode });
                        }
                    }
                    catch (queueError) {
                        console.debug('Falha ao obter modo de IA da fila', {
                            queueId: selectedTicketQueueId,
                            error: queueError,
                        });
                    }
                }
            }
            catch (error) {
                console.debug('Falha ao obter modo de IA', { error });
            }
            finally {
                if (isMounted) {
                    setIsAiModeReady(true);
                }
            }
        };
        void loadAiMode();
        return () => {
            isMounted = false;
        };
    }, [tenantId, selectedTicketQueueId]);
    const ticketAiMode = useMemo(() => resolveTicketAiMode(selectedTicket), [selectedTicket]);
    const aiConfidence = useMemo(() => resolveTicketAiConfidence(selectedTicket), [selectedTicket]);
    const aiMode = useMemo(() => {
        if (!selectedTicketKey) {
            return ticketAiMode ?? globalAiMode ?? DEFAULT_AI_MODE;
        }
        const queueMode = selectedTicketQueueId ? aiModesByQueue[selectedTicketQueueId] : null;
        return (aiModesByTicket[selectedTicketKey] ??
            ticketAiMode ??
            queueMode ??
            globalAiMode ??
            DEFAULT_AI_MODE);
    }, [aiModesByQueue, aiModesByTicket, globalAiMode, selectedTicketKey, selectedTicketQueueId, ticketAiMode]);
    const persistAiMode = useCallback(async (mode, queueId) => {
        try {
            const body = { mode };
            if (queueId) {
                body.queueId = queueId;
            }
            await apiPost('/api/ai/mode', body);
        }
        catch (error) {
            console.debug('Falha ao persistir modo de IA', { mode, queueId, error });
        }
    }, []);
    const updateAiModePreference = useCallback((mode, queueId) => {
        if (queueId) {
            setAiModesByQueue((prev) => prev[queueId] === mode ? prev : { ...prev, [queueId]: mode });
        }
        else {
            setGlobalAiMode((current) => (current === mode ? current : mode));
        }
        void persistAiMode(mode, queueId);
    }, [persistAiMode]);
    const setAiModeForTicket = useCallback((mode, queueId) => {
        if (selectedTicketKey) {
            setAiModesByTicket((previous) => {
                const current = previous[selectedTicketKey];
                if (current === mode) {
                    return previous;
                }
                return { ...previous, [selectedTicketKey]: mode };
            });
        }
        updateAiModePreference(mode, queueId);
    }, [selectedTicketKey, updateAiModePreference]);
    const handleAiModeChange = useCallback((mode) => {
        if (!isAiModeReady) {
            return;
        }
        setAiModeForTicket(mode, selectedTicketQueueId ?? null);
        if (selectedTicketIdValue != null) {
            emitInboxTelemetry('chat.ai.mode.select', {
                ticketId: selectedTicketIdValue,
                mode,
            });
        }
    }, [isAiModeReady, selectedTicketIdValue, selectedTicketQueueId, setAiModeForTicket]);
    const handleAiTakeOver = useCallback(() => {
        if (selectedTicketIdValue == null || !isAiModeReady) {
            return;
        }
        setAiModeForTicket('manual', selectedTicketQueueId ?? null);
        emitInboxTelemetry('chat.ai.mode.take_over', {
            ticketId: selectedTicketIdValue,
            mode: 'manual',
        });
    }, [isAiModeReady, selectedTicketIdValue, selectedTicketQueueId, setAiModeForTicket]);
    const handleAiGiveBack = useCallback(() => {
        if (selectedTicketIdValue == null || !isAiModeReady) {
            return;
        }
        setAiModeForTicket('auto', selectedTicketQueueId ?? null);
        emitInboxTelemetry('chat.ai.mode.give_back', {
            ticketId: selectedTicketIdValue,
            mode: 'auto',
        });
    }, [isAiModeReady, selectedTicketIdValue, selectedTicketQueueId, setAiModeForTicket]);
    const manualConversation = useManualConversationFlow({ controller });
    const availability = useWhatsAppAvailability({ selectedTicketId: controller.selectedTicketId });
    const fieldUpdaters = useTicketFieldUpdaters({
        controller,
        selectedTicket,
        selectedContact,
        selectedLead,
        currentUser: currentUser ?? null,
    });
    const sendMessage = useCallback(({ content, attachments = [], template, caption, instanceId, instanceLabel, defaultInstanceId, }) => {
        const files = Array.isArray(attachments) ? attachments : [];
        const trimmed = (content ?? '').trim();
        if (!trimmed && files.length === 0 && !template) {
            return;
        }
        const metadata = {};
        if (files.length > 0) {
            const normalizedAttachments = files.reduce((list, file) => {
                const normalizedMime = file?.mimeType ?? file?.mediaMimeType ?? file?.type ?? null;
                const normalizedName = file?.fileName ?? file?.mediaFileName ?? file?.name ?? null;
                const attachment = {};
                if (file?.id) {
                    attachment.id = file.id;
                }
                const resolvedName = file?.name ?? normalizedName ?? undefined;
                if (typeof resolvedName === 'string' && resolvedName.length > 0) {
                    attachment.name = resolvedName;
                }
                const resolvedSize = file?.size ?? file?.mediaSize;
                if (typeof resolvedSize === 'number' && Number.isFinite(resolvedSize)) {
                    attachment.size = resolvedSize;
                }
                if (file?.type) {
                    attachment.type = file.type;
                }
                if (normalizedMime) {
                    attachment.mimeType = normalizedMime;
                }
                if (normalizedName) {
                    attachment.fileName = normalizedName;
                }
                if (file?.mediaUrl) {
                    attachment.mediaUrl = file.mediaUrl;
                }
                if (Object.keys(attachment).length > 0) {
                    list.push(attachment);
                }
                return list;
            }, []);
            if (normalizedAttachments.length > 0) {
                metadata.attachments = normalizedAttachments;
            }
        }
        if (template) {
            const templateMetadata = {
                id: template.id ?? template.name ?? 'template',
                label: template.label ?? template.name ?? template.id ?? 'template',
            };
            const templateBody = template.body ?? template.content ?? null;
            if (typeof templateBody === 'string') {
                templateMetadata.body = templateBody;
            }
            metadata.template = templateMetadata;
        }
        const hasAttachments = files.length > 0;
        const payloadContent = hasAttachments
            ? trimmed || '[Anexo enviado]'
            : trimmed || metadata.template?.body || metadata.template?.label || (template ? 'Template enviado' : '');
        const normalizedCaption = hasAttachments ? caption ?? (trimmed.length > 0 ? trimmed : undefined) : caption;
        const [primaryAttachment] = files;
        const primaryMetadata = metadata.attachments?.[0];
        const mutationPayload = {
            content: payloadContent,
        };
        if (controller.selectedTicketId !== undefined) {
            mutationPayload.ticketId = controller.selectedTicketId;
        }
        if (metadata.attachments || metadata.template) {
            mutationPayload.metadata = metadata;
        }
        const whatsappMetadataSource = metadata.whatsapp && typeof metadata.whatsapp === 'object'
            ? metadata.whatsapp
            : {};
        const whatsappMetadata = { ...whatsappMetadataSource };
        if (instanceId) {
            mutationPayload.instanceId = instanceId;
            whatsappMetadata.instanceId = instanceId;
            if (instanceLabel) {
                whatsappMetadata.instanceLabel = instanceLabel;
            }
            if (defaultInstanceId && instanceId !== defaultInstanceId) {
                whatsappMetadata.instanceOverride = instanceId;
                whatsappMetadata.defaultInstanceId = defaultInstanceId;
            }
            else if (defaultInstanceId && whatsappMetadata.defaultInstanceId === undefined) {
                whatsappMetadata.defaultInstanceId = defaultInstanceId;
            }
        }
        else if (defaultInstanceId && whatsappMetadata.defaultInstanceId === undefined) {
            whatsappMetadata.defaultInstanceId = defaultInstanceId;
        }
        const ticketSourceInstance = resolveTicketSourceInstance(selectedTicket);
        const resolvedSourceInstance = instanceLabel ??
            instanceId ??
            (defaultInstanceId && typeof defaultInstanceId === 'string' ? defaultInstanceId : null) ??
            ticketSourceInstance;
        if (resolvedSourceInstance && metadata.sourceInstance === undefined) {
            metadata.sourceInstance = resolvedSourceInstance;
        }
        const enrichmentMetadata = {
            campaignId: resolveTicketCampaignId(selectedTicket),
            campaignName: resolveTicketCampaignName(selectedTicket),
            productType: resolveTicketProductType(selectedTicket),
            strategy: resolveTicketStrategy(selectedTicket),
        };
        Object.entries(enrichmentMetadata).forEach(([key, value]) => {
            if (value && metadata[key] === undefined) {
                metadata[key] = value;
            }
        });
        if (Object.keys(whatsappMetadata).length > 0) {
            mutationPayload.metadata = {
                ...(mutationPayload.metadata ?? {}),
                whatsapp: whatsappMetadata,
            };
        }
        if (hasAttachments) {
            const mime = primaryAttachment?.mimeType ??
                primaryAttachment?.mediaMimeType ??
                primaryAttachment?.type ??
                primaryMetadata?.mimeType ??
                primaryMetadata?.type ??
                null;
            mutationPayload.type = inferMessageTypeFromMime(mime ?? undefined);
            const mediaUrl = primaryAttachment?.mediaUrl ?? primaryMetadata?.mediaUrl ?? undefined;
            if (mediaUrl !== undefined) {
                mutationPayload.mediaUrl = mediaUrl ?? null;
            }
            if (mime) {
                mutationPayload.mediaMimeType = mime;
            }
            const mediaFileName = primaryAttachment?.fileName ??
                primaryAttachment?.mediaFileName ??
                primaryAttachment?.name ??
                primaryMetadata?.fileName ??
                null;
            if (mediaFileName) {
                mutationPayload.mediaFileName = mediaFileName;
            }
            if (normalizedCaption !== undefined) {
                mutationPayload.caption = normalizedCaption ?? null;
            }
        }
        else if (normalizedCaption !== undefined) {
            mutationPayload.caption = normalizedCaption ?? null;
        }
        controller.sendMessageMutation.mutate(mutationPayload, {
            onSuccess: (result) => {
                const error = result?.error;
                if (error) {
                    availability.notifyOutboundError(error, error?.message ?? 'Não foi possível enviar a mensagem.');
                    return;
                }
                availability.resetAvailability();
                emitInboxTelemetry('chat.outbound_message', {
                    ticketId: controller.selectedTicketId,
                    hasTemplate: Boolean(template),
                    hasAttachments,
                });
            },
            onError: (error) => {
                const normalizedPayloadError = error?.payload?.error ?? error?.error ?? null;
                const fallbackMessage = normalizedPayloadError?.recoveryHint ??
                    normalizedPayloadError?.message ??
                    error?.message ??
                    'Erro inesperado ao enviar';
                const outboundError = normalizedPayloadError
                    ? {
                        ...(typeof error === 'object' && error !== null ? error : {}),
                        message: fallbackMessage,
                        payload: {
                            ...(typeof error?.payload === 'object' && error?.payload !== null ? error.payload : {}),
                            error: normalizedPayloadError,
                            requestId: error?.payload?.requestId ?? normalizedPayloadError.requestId ?? null,
                            recoveryHint: error?.payload?.recoveryHint ?? normalizedPayloadError.recoveryHint ?? null,
                        },
                    }
                    : error;
                availability.notifyOutboundError(outboundError, fallbackMessage);
                emitInboxTelemetry('chat.outbound_error', {
                    ticketId: controller.selectedTicketId,
                    error: normalizedPayloadError?.code ?? error?.message,
                    hasTemplate: Boolean(template),
                });
            },
        });
    }, [availability, controller, selectedTicket]);
    const createNote = useCallback((body) => {
        const payload = { ticketId: controller.selectedTicketId, body };
        controller.notesMutation.mutate(payload, {
            onSuccess: () => {
                toast.success('Nota registrada');
            },
            onError: (error) => {
                toast.error('Erro ao registrar nota', { description: error?.message });
                emitInboxTelemetry('chat.note.autosave_error', {
                    ticketId: controller.selectedTicketId,
                    message: error?.message,
                });
            },
        });
    }, [controller]);
    const registerResult = useCallback(async ({ outcome, reason }) => {
        if (!controller.selectedTicketId)
            return;
        const payload = {
            ticketId: controller.selectedTicketId,
            status: outcome === 'won' ? 'RESOLVED' : 'CLOSED',
        };
        if (typeof reason === 'string') {
            payload.reason = reason.length > 0 ? reason : null;
        }
        try {
            await controller.statusMutation.mutateAsync(payload);
            toast.success('Resultado registrado.');
        }
        catch (error) {
            toast.error('Não foi possível concluir. Tente novamente.', {
                description: error?.message,
            });
            throw error;
        }
    }, [controller]);
    const handleBulkLossConfirm = useCallback(async ({ reason, notes }) => {
        const ticketIds = controller.selectedTicketIds ?? [];
        if (ticketIds.length === 0) {
            toast.error('Selecione ao menos um ticket para registrar perda.');
            return;
        }
        const reasonLabel = LOSS_REASON_HELPERS[reason] ?? reason;
        const finalReason = notes ? `${reasonLabel} — ${notes}` : reasonLabel;
        setBulkLossSubmitting(true);
        try {
            for (const ticketId of ticketIds) {
                await controller.statusMutation.mutateAsync({
                    ticketId,
                    status: 'CLOSED',
                    reason: finalReason,
                });
            }
            const message = ticketIds.length === 1
                ? 'Perda registrada para 1 ticket.'
                : `Perda registrada para ${ticketIds.length} tickets.`;
            toast.success(message);
            controller.clearTicketSelection();
            setBulkLossDialogOpen(false);
        }
        catch (error) {
            toast.error('Não foi possível concluir. Tente novamente.', {
                description: error?.message,
            });
        }
        finally {
            setBulkLossSubmitting(false);
        }
    }, [controller]);
    const assignToMe = useCallback((ticket, targetUserId) => {
        const ticketId = ticket?.id ?? controller.selectedTicketId;
        if (!ticketId) {
            toast.error('Selecione um atendimento para atribuir', {
                description: 'Escolha um ticket antes de definir o responsável.',
            });
            return;
        }
        const resolvedUserId = targetUserId ?? currentUser?.id ?? null;
        if (!resolvedUserId) {
            toast.error('Informe o responsável pelo ticket', {
                description: 'Escolha um agente ou faça login novamente para assumir o atendimento.',
            });
            return;
        }
        const payload = {
            ticketId,
            userId: resolvedUserId,
        };
        controller.assignMutation.mutate(payload, {
            onSuccess: () => toast.success('Ticket atribuído'),
            onError: (error) => toast.error('Erro ao atribuir ticket', { description: error?.message }),
        });
    }, [controller, currentUser?.id]);
    const handleScheduleFollowUp = useCallback(() => {
        toast.info('Agendar follow-up', {
            description: 'Conecte um calendário para programar o próximo contato.',
        });
        emitInboxTelemetry('chat.follow_up.requested', {
            ticketId: controller.selectedTicketId,
        });
    }, [controller.selectedTicketId]);
    const handleSendSms = useCallback((phoneNumber) => {
        if (!phoneNumber)
            return;
        emitInboxTelemetry('chat.sms.triggered', {
            ticketId: controller.selectedTicketId,
            phoneNumber,
        });
    }, [controller.selectedTicketId]);
    const handleEditContact = useCallback((contactId) => {
        if (!contactId)
            return;
        emitInboxTelemetry('chat.contact.edit_requested', {
            ticketId: controller.selectedTicketId,
            contactId,
        });
        toast.info('Edição de contato', {
            description: 'Integração com editor de contato ainda não está disponível neste ambiente.',
        });
    }, [controller.selectedTicketId]);
    const handleSendTemplate = useCallback((template) => {
        if (!template)
            return;
        sendMessage({ content: template.body ?? template.content ?? '', template });
    }, [sendMessage]);
    const handleCreateNextStep = useCallback(async ({ description, dueAt }) => {
        const contactId = controller.selectedTicket?.contact?.id;
        const ticketId = controller.selectedTicketId;
        if (!contactId || !description) {
            toast.error('Preencha a descrição do próximo passo.');
            return;
        }
        try {
            const payload = {
                description,
                type: 'follow_up',
                dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
                metadata: {
                    ticketId,
                },
            };
            const response = await apiPost(`/api/contacts/${contactId}/tasks`, payload);
            toast.success('Próximo passo registrado');
            emitInboxTelemetry('chat.next_step.created', {
                ticketId,
                contactId,
                dueAt: payload.dueAt,
            });
            return response?.data ?? response ?? null;
        }
        catch (error) {
            const message = error?.message ?? 'Não foi possível criar o próximo passo.';
            toast.error('Não foi possível criar o próximo passo', { description: message });
            emitInboxTelemetry('chat.next_step.error', {
                ticketId,
                contactId,
                message,
            });
            throw error;
        }
    }, [controller]);
    const handleRegisterCallResult = useCallback(({ outcome, notes }) => {
        const ticketId = controller.selectedTicketId;
        emitInboxTelemetry('chat.call.result_logged', {
            ticketId,
            outcome,
        });
        toast.success('Resultado da chamada registrado');
        if (notes) {
            createNote(`📞 ${outcome}: ${notes}`);
        }
    }, [controller.selectedTicketId, createNote]);
    const metrics = controller.metrics;
    const filters = controller.filters;
    const filterOptionSets = useMemo(() => buildFilterOptions(controller.tickets ?? []), [controller.tickets]);
    const lastQueueAlertRef = useRef(null);
    useEffect(() => {
        const alerts = Array.isArray(controller.queueAlerts)
            ? controller.queueAlerts
            : [];
        if (alerts.length === 0) {
            return;
        }
        const [latest] = alerts;
        const latestTimestamp = typeof latest?.timestamp === 'number' ? latest.timestamp : null;
        if (latestTimestamp === null) {
            return;
        }
        if (lastQueueAlertRef.current === latestTimestamp) {
            return;
        }
        lastQueueAlertRef.current = latestTimestamp;
        toast.warning('🚨 Fila padrão ausente', {
            description: 'Nenhuma fila ativa foi encontrada para o tenant. Configure em Configurações → Filas para destravar o atendimento inbound.',
        });
    }, [controller.queueAlerts]);
    const handleManualSync = useCallback(() => {
        const toastId = 'chat-sync-tickets';
        toast.loading('🔄 Sincronizando tickets diretamente da API...', { id: toastId });
        controller.ticketsQuery
            .refetch({ cancelRefetch: false, throwOnError: false })
            .then((result) => {
            if (result.error) {
                toast.error('Falha ao sincronizar tickets', {
                    id: toastId,
                    description: result.error?.message ?? 'Erro não identificado. Tente novamente em instantes.',
                });
                return;
            }
            const total = Array.isArray(result.data?.items) ? result.data.items.length : '—';
            toast.success('Tickets sincronizados com sucesso', {
                id: toastId,
                description: `Total retornado agora: ${total}. Atualização forçada sem cache executada.`,
            });
        })
            .catch((error) => {
            toast.error('Falha ao sincronizar tickets', {
                id: toastId,
                description: error?.message ?? 'Erro não identificado. Tente novamente em instantes.',
            });
        });
    }, [controller.ticketsQuery]);
    const canAssign = Boolean(selectedTicket);
    const canScheduleFollowUp = Boolean(selectedTicket);
    const canRegisterResult = Boolean(selectedTicket);
    const conversationAssignHandler = canAssign
        ? (ticketArg, targetUserId) => assignToMe(ticketArg ?? selectedTicket ?? undefined, targetUserId ?? null)
        : undefined;
    const conversationScheduleFollowUpHandler = canScheduleFollowUp ? handleScheduleFollowUp : undefined;
    const conversationRegisterResultHandler = canRegisterResult ? registerResult : undefined;
    const conversationRegisterCallResultHandler = selectedTicket ? handleRegisterCallResult : undefined;
    const bulkSelectedTicketIds = controller.selectedTicketIds ?? [];
    const hasBulkSelection = bulkSelectedTicketIds.length > 0;
    const manualConversationProps = {
        isAvailable: manualConversation.isAvailable,
        isOpen: manualConversation.isDialogOpen,
        onOpenChange: manualConversation.setDialogOpen,
        onSubmit: manualConversation.onSubmit,
        onSuccess: manualConversation.onSuccess,
        isPending: manualConversation.isPending,
        error: manualConversation.error,
        unavailableReason: manualConversation.unavailableReason,
        openDialog: manualConversation.openDialog,
    };
    const queueListProps = {
        tickets: controller.tickets,
        selectedTicketId: controller.selectedTicketId,
        selectedTicketIds: bulkSelectedTicketIds,
        onSelectTicket: controller.selectTicket,
        onToggleTicketSelection: controller.toggleTicketSelection,
        onClearSelection: controller.clearTicketSelection,
        loading: controller.ticketsQuery.isFetching,
        onRefresh: handleManualSync,
        typingAgents: controller.typingIndicator?.agentsTyping ?? [],
        metrics,
        onBulkRegisterLoss: () => setBulkLossDialogOpen(true),
        bulkActionPending: isBulkLossSubmitting,
        bulkActionsDisabled: isBulkLossSubmitting || !hasBulkSelection,
    };
    const filterToolbarProps = {
        search: filters.search ?? '',
        onSearchChange: controller.setSearch,
        filters,
        onFiltersChange: controller.setFilters,
        loading: controller.ticketsQuery.isFetching,
        onRefresh: handleManualSync,
        instanceOptions: filterOptionSets.instanceOptions,
        campaignOptions: filterOptionSets.campaignOptions,
        productTypeOptions: filterOptionSets.productTypeOptions,
        strategyOptions: filterOptionSets.strategyOptions,
        onStartManualConversation: manualConversation.isAvailable ? manualConversation.openDialog : undefined,
        manualConversationPending: manualConversation.isPending,
        manualConversationUnavailableReason: manualConversation.unavailableReason,
    };
    const conversationAreaProps = {
        ticket: controller.selectedTicket,
        conversation: controller.conversation,
        messagesQuery: controller.messagesQuery,
        onSendMessage: sendMessage,
        onCreateNote: createNote,
        onSendTemplate: handleSendTemplate,
        onCreateNextStep: handleCreateNextStep,
        onRegisterResult: conversationRegisterResultHandler,
        onRegisterCallResult: conversationRegisterCallResultHandler,
        onAssign: conversationAssignHandler,
        onScheduleFollowUp: conversationScheduleFollowUpHandler,
        onSendSMS: handleSendSms,
        onEditContact: handleEditContact,
        isRegisteringResult: controller.statusMutation.isPending,
        typingIndicator: controller.typingIndicator,
        isSending: controller.sendMessageMutation.isPending,
        sendError: controller.sendMessageMutation.error,
        composerDisabled: availability.composerDisabled,
        composerDisabledReason: availability.unavailableReason,
        composerNotice: availability.notice,
        onContactFieldSave: fieldUpdaters.onContactFieldSave,
        onDealFieldSave: fieldUpdaters.onDealFieldSave,
        nextStepValue: fieldUpdaters.nextStepValue,
        onNextStepSave: fieldUpdaters.onNextStepSave,
        aiMode,
        aiConfidence,
        aiModeChangeDisabled: !isAiModeReady,
        onTakeOver: selectedTicket && isAiModeReady ? handleAiTakeOver : undefined,
        onGiveBackToAi: selectedTicket && isAiModeReady ? handleAiGiveBack : undefined,
        onAiModeChange: selectedTicket && isAiModeReady ? handleAiModeChange : undefined,
    };
    return (_jsxs(WhatsAppInstancesProvider, { autoRefresh: true, initialFetch: true, logger: {}, children: [_jsx(ChatCommandCenter, { currentUser: currentUser, manualConversation: manualConversationProps, queueList: queueListProps, filterToolbar: filterToolbarProps, conversationArea: conversationAreaProps }), _jsx(LossReasonDialog, { open: isBulkLossDialogOpen, onOpenChange: setBulkLossDialogOpen, options: LOSS_REASONS, onConfirm: handleBulkLossConfirm, isSubmitting: isBulkLossSubmitting })] }));
};
export default ChatCommandCenterContainer;
