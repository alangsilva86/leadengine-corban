import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { ChatCommandCenter } from '../ChatCommandCenter.jsx';
import type { NotesMutationVariables } from '../api/useNotesMutation.js';
import type { SendMessageMutationVariables, ChatMessageMetadata, ChatAttachmentMetadata } from '../api/useSendMessage.js';
import type { TicketAssignMutationVariables } from '../api/useTicketAssignMutation.js';
import type { TicketStatusMutationVariables } from '../api/useTicketStatusMutation.js';
import useChatController from '../hooks/useChatController.js';
import useManualConversationFlow from '../hooks/useManualConversationFlow';
import useTicketFieldUpdaters from '../hooks/useTicketFieldUpdaters';
import useWhatsAppAvailability from '../hooks/useWhatsAppAvailability';
import emitInboxTelemetry from '../utils/telemetry.js';
import { WhatsAppInstancesProvider } from '@/features/whatsapp/hooks/useWhatsAppInstances.jsx';
import { getTenantId } from '@/lib/auth.js';
import { apiPost } from '@/lib/api.js';

type AttachmentLike = {
  id?: string | null;
  name?: string | null;
  size?: number | null;
  type?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaSize?: number | null;
};

type TemplateLike = {
  id?: string | null;
  name?: string | null;
  label?: string | null;
  body?: string | null;
  content?: string | null;
};

type QueueAlertLike = {
  timestamp?: number | null;
  payload?: { instanceId?: string | null } | null;
};

interface SendMessageInput {
  content?: string | null;
  attachments?: AttachmentLike[] | null;
  template?: TemplateLike | null;
  caption?: string | null;
}

const inferMessageTypeFromMime = (mimeType: unknown) => {
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

export interface ChatCommandCenterContainerProps {
  tenantId?: string | null;
  currentUser?: { id?: string | null } | null;
}

export const ChatCommandCenterContainer = ({ tenantId: tenantIdProp, currentUser }: ChatCommandCenterContainerProps) => {
  const tenantId = tenantIdProp ?? getTenantId() ?? 'demo-tenant';
  const controller = useChatController({ tenantId, currentUser });
  const selectedTicket = controller.selectedTicket ?? null;
  const selectedContact = selectedTicket?.contact ?? null;
  const selectedLead = selectedTicket?.lead ?? null;

  const manualConversation = useManualConversationFlow({ controller });
  const availability = useWhatsAppAvailability({ selectedTicketId: controller.selectedTicketId });
  const fieldUpdaters = useTicketFieldUpdaters({
    controller,
    selectedTicket,
    selectedContact,
    selectedLead,
    currentUser: currentUser ?? null,
  });

  const sendMessage = useCallback(
    ({ content, attachments = [], template, caption }: SendMessageInput) => {
      const files = Array.isArray(attachments) ? attachments : [];
      const trimmed = (content ?? '').trim();
      if (!trimmed && files.length === 0 && !template) {
        return;
      }

      const metadata: ChatMessageMetadata = {};

      if (files.length > 0) {
        const normalizedAttachments = files.reduce<ChatAttachmentMetadata[]>((list, file) => {
          const normalizedMime = file?.mimeType ?? file?.mediaMimeType ?? file?.type ?? null;
          const normalizedName = file?.fileName ?? file?.mediaFileName ?? file?.name ?? null;
          const attachment: ChatAttachmentMetadata = {};

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
        const templateMetadata: NonNullable<ChatMessageMetadata['template']> = {
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

      const mutationPayload: SendMessageMutationVariables = {
        content: payloadContent,
      };

      if (controller.selectedTicketId !== undefined) {
        mutationPayload.ticketId = controller.selectedTicketId;
      }

      if (metadata.attachments || metadata.template) {
        mutationPayload.metadata = metadata;
      }

      if (hasAttachments) {
        const mime =
          primaryAttachment?.mimeType ??
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
        const mediaFileName =
          primaryAttachment?.fileName ??
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
      } else if (normalizedCaption !== undefined) {
        mutationPayload.caption = normalizedCaption ?? null;
      }

      controller.sendMessageMutation.mutate(mutationPayload, {
        onSuccess: (result: unknown) => {
          const error = (result as { error?: { message?: string } } | null)?.error;
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
        onError: (error: any) => {
          const fallbackMessage = error?.message ?? 'Erro inesperado ao enviar';
          availability.notifyOutboundError(error, fallbackMessage);
          emitInboxTelemetry('chat.outbound_error', {
            ticketId: controller.selectedTicketId,
            error: error?.message,
            hasTemplate: Boolean(template),
          });
        },
      });
    },
    [availability, controller]
  );

  const createNote = useCallback(
    (body: string) => {
      const payload: NotesMutationVariables = { ticketId: controller.selectedTicketId, body };
      controller.notesMutation.mutate(
        payload,
        {
          onSuccess: () => {
            toast.success('Nota registrada');
          },
          onError: (error: any) => {
            toast.error('Erro ao registrar nota', { description: error?.message });
            emitInboxTelemetry('chat.note.autosave_error', {
              ticketId: controller.selectedTicketId,
              message: error?.message,
            });
          },
        }
      );
    },
    [controller]
  );

  const registerResult = useCallback(
    async ({ outcome, reason }: { outcome: string; reason?: string }) => {
      if (!controller.selectedTicketId) return;

      const payload: TicketStatusMutationVariables = {
        ticketId: controller.selectedTicketId,
        status: outcome === 'won' ? 'RESOLVED' : 'CLOSED',
      };

      if (typeof reason === 'string') {
        payload.reason = reason.length > 0 ? reason : null;
      }

      try {
        await controller.statusMutation.mutateAsync(payload);
        toast.success('Resultado registrado.');
      } catch (error: any) {
        toast.error('Não foi possível concluir. Tente novamente.', {
          description: error?.message,
        });
        throw error;
      }
    },
    [controller]
  );

  const assignToMe = useCallback(
    (ticket?: { id?: string | null }) => {
      if (!currentUser?.id) {
        toast.error('Faça login para atribuir tickets', {
          description: 'Entre novamente para assumir atendimentos na inbox.',
        });
        return;
      }
      const payload: TicketAssignMutationVariables = {
        ticketId: ticket?.id ?? controller.selectedTicketId,
        userId: currentUser.id,
      };
      controller.assignMutation.mutate(
        payload,
        {
          onSuccess: () => toast.success('Ticket atribuído'),
          onError: (error: any) => toast.error('Erro ao atribuir ticket', { description: error?.message }),
        }
      );
    },
    [controller, currentUser?.id]
  );

  const handleGenerateProposal = useCallback(() => {
    toast.success('Proposta gerada.');
  }, []);

  const handleScheduleFollowUp = useCallback(() => {
    toast.info('Agendar follow-up', {
      description: 'Conecte um calendário para programar o próximo contato.',
    });
    emitInboxTelemetry('chat.follow_up.requested', {
      ticketId: controller.selectedTicketId,
    });
  }, [controller.selectedTicketId]);

  const handleSendSms = useCallback(
    (phoneNumber: string) => {
      if (!phoneNumber) return;
      emitInboxTelemetry('chat.sms.triggered', {
        ticketId: controller.selectedTicketId,
        phoneNumber,
      });
    },
    [controller.selectedTicketId]
  );

  const handleEditContact = useCallback(
    (contactId: string) => {
      if (!contactId) return;
      emitInboxTelemetry('chat.contact.edit_requested', {
        ticketId: controller.selectedTicketId,
        contactId,
      });
      toast.info('Edição de contato', {
        description: 'Integração com editor de contato ainda não está disponível neste ambiente.',
      });
    },
    [controller.selectedTicketId]
  );

  const handleSendTemplate = useCallback(
    (template: any) => {
      if (!template) return;
      sendMessage({ content: template.body ?? template.content ?? '', template });
    },
    [sendMessage]
  );

  const handleCreateNextStep = useCallback(
    async ({ description, dueAt }: { description: string; dueAt?: string }) => {
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
      } catch (error: any) {
        const message = error?.message ?? 'Não foi possível criar o próximo passo.';
        toast.error('Não foi possível criar o próximo passo', { description: message });
        emitInboxTelemetry('chat.next_step.error', {
          ticketId,
          contactId,
          message,
        });
        throw error;
      }
    },
    [controller]
  );

  const handleRegisterCallResult = useCallback(
    ({ outcome, notes }: { outcome: string; notes?: string }) => {
      const ticketId = controller.selectedTicketId;
      emitInboxTelemetry('chat.call.result_logged', {
        ticketId,
        outcome,
      });
      toast.success('Resultado da chamada registrado');
      if (notes) {
        createNote(`📞 ${outcome}: ${notes}`);
      }
    },
    [controller.selectedTicketId, createNote]
  );

  const metrics = controller.metrics;
  const filters = controller.filters;

  const lastQueueAlertRef = useRef<number | null>(null);

  useEffect(() => {
    const alerts = Array.isArray(controller.queueAlerts)
      ? (controller.queueAlerts as QueueAlertLike[])
      : [];
    if (alerts.length === 0) {
      return;
    }
    const [latest] = alerts;
    const latestTimestamp =
      typeof latest?.timestamp === 'number' ? latest.timestamp : null;
    if (latestTimestamp === null) {
      return;
    }
    if (lastQueueAlertRef.current === latestTimestamp) {
      return;
    }
    lastQueueAlertRef.current = latestTimestamp;
    toast.warning('🚨 Fila padrão ausente', {
      description:
        'Nenhuma fila ativa foi encontrada para o tenant. Configure em Configurações → Filas para destravar o atendimento inbound.',
    });
  }, [controller.queueAlerts]);

  const handleManualSync = useCallback(() => {
    const toastId = 'chat-sync-tickets';
    toast.loading('🔄 Sincronizando tickets diretamente da API...', { id: toastId });
    controller.ticketsQuery
      .refetch({ cancelRefetch: false, throwOnError: false })
      .then((result: any) => {
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
      .catch((error: any) => {
        toast.error('Falha ao sincronizar tickets', {
          id: toastId,
          description: error?.message ?? 'Erro não identificado. Tente novamente em instantes.',
        });
      });
  }, [controller.ticketsQuery]);

  const canAssign = Boolean(selectedTicket);
  const canScheduleFollowUp = Boolean(selectedTicket);
  const canRegisterResult = Boolean(selectedTicket);

  const conversationAssignHandler = canAssign ? () => assignToMe(selectedTicket ?? undefined) : undefined;
  const conversationScheduleFollowUpHandler = canScheduleFollowUp ? handleScheduleFollowUp : undefined;
  const conversationRegisterResultHandler = canRegisterResult ? registerResult : undefined;
  const conversationRegisterCallResultHandler = selectedTicket ? handleRegisterCallResult : undefined;

  const manualConversationProps = {
    isAvailable: manualConversation.isAvailable,
    isOpen: manualConversation.isDialogOpen,
    onOpenChange: manualConversation.setDialogOpen,
    onSubmit: manualConversation.onSubmit,
    onSuccess: manualConversation.onSuccess,
    isPending: manualConversation.isPending,
    unavailableReason: manualConversation.unavailableReason,
    openDialog: manualConversation.openDialog,
  };

  const queueListProps = {
    tickets: controller.tickets,
    selectedTicketId: controller.selectedTicketId,
    onSelectTicket: controller.selectTicket,
    loading: controller.ticketsQuery.isFetching,
    onRefresh: handleManualSync,
    typingAgents: controller.typingIndicator?.agentsTyping ?? [],
    metrics,
  };

  const filterToolbarProps = {
    search: filters.search ?? '',
    onSearchChange: controller.setSearch,
    filters,
    onFiltersChange: controller.setFilters,
    loading: controller.ticketsQuery.isFetching,
    onRefresh: handleManualSync,
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
    onGenerateProposal: handleGenerateProposal,
    onScheduleFollowUp: conversationScheduleFollowUpHandler,
    onSendSMS: handleSendSms,
    onEditContact: handleEditContact,
    isRegisteringResult: controller.statusMutation.isPending,
    typingIndicator: controller.typingIndicator,
    isSending: controller.sendMessageMutation.isPending,
    sendError: controller.sendMessageMutation.error,
    composerDisabled: availability.composerDisabled,
    composerDisabledReason: availability.unavailableReason,
    onContactFieldSave: fieldUpdaters.onContactFieldSave,
    onDealFieldSave: fieldUpdaters.onDealFieldSave,
    nextStepValue: fieldUpdaters.nextStepValue,
    onNextStepSave: fieldUpdaters.onNextStepSave,
  };

  return (
    <WhatsAppInstancesProvider autoRefresh={false} initialFetch={false} logger={{}}>
      <ChatCommandCenter
        currentUser={currentUser}
        manualConversation={manualConversationProps}
        queueList={queueListProps}
        filterToolbar={filterToolbarProps}
        conversationArea={conversationAreaProps}
      />
    </WhatsAppInstancesProvider>
  );
};

export default ChatCommandCenterContainer;
