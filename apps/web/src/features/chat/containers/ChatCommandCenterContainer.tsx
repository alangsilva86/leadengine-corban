import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { ChatCommandCenter } from '../ChatCommandCenter.jsx';
import useChatController from '../hooks/useChatController.js';
import useManualConversationFlow from '../hooks/useManualConversationFlow.ts';
import useTicketFieldUpdaters from '../hooks/useTicketFieldUpdaters.ts';
import useWhatsAppAvailability from '../hooks/useWhatsAppAvailability.ts';
import emitInboxTelemetry from '../utils/telemetry.js';
import { WhatsAppInstancesProvider } from '@/features/whatsapp/hooks/useWhatsAppInstances.jsx';
import { getTenantId } from '@/lib/auth.js';
import { apiPost } from '@/lib/api.js';

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

interface ChatCommandCenterContainerProps {
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
    currentUser,
  });

  const sendMessage = useCallback(
    ({ content, attachments = [], template, caption }: any) => {
      const trimmed = (content ?? '').trim();
      if (!trimmed && attachments.length === 0 && !template) {
        return;
      }

      const metadata: Record<string, unknown> = {};

      if (attachments.length > 0) {
        const normalizedAttachments = attachments.map((file: any) => {
          const normalizedMime = file.mimeType ?? file.mediaMimeType ?? file.type ?? null;
          const normalizedName = file.fileName ?? file.mediaFileName ?? file.name ?? null;
          const record = {
            id: file.id,
            name: file.name ?? normalizedName ?? undefined,
            size: file.size ?? file.mediaSize ?? undefined,
            type: file.type ?? undefined,
            mimeType: normalizedMime ?? undefined,
            fileName: normalizedName ?? undefined,
            mediaUrl: file.mediaUrl ?? undefined,
          };
          return Object.fromEntries(
            Object.entries(record).filter(([, value]) => value !== undefined && value !== null)
          );
        });

        const filtered = normalizedAttachments.filter((entry: Record<string, unknown>) => Object.keys(entry).length > 0);
        if (filtered.length > 0) {
          metadata.attachments = filtered;
        }
      }

      if (template) {
        metadata.template = {
          id: template.id ?? template.name ?? 'template',
          label: template.label ?? template.name ?? template.id ?? 'template',
          body: template.body ?? template.content ?? undefined,
        };
      }

      const hasAttachments = attachments.length > 0;
      const payloadContent = hasAttachments
        ? trimmed || '[Anexo enviado]'
        : trimmed || metadata.template?.body || metadata.template?.label || (template ? 'Template enviado' : '');
      const normalizedCaption = hasAttachments ? caption ?? (trimmed.length > 0 ? trimmed : undefined) : caption;

      const [primaryAttachment] = attachments;
      const primaryMetadata = (metadata.attachments as any)?.[0];

      const mutationPayload: Record<string, unknown> = {
        ticketId: controller.selectedTicketId,
        content: payloadContent,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };

      if (hasAttachments) {
        const mime =
          primaryAttachment?.mimeType ??
          primaryAttachment?.mediaMimeType ??
          primaryAttachment?.type ??
          primaryMetadata?.mimeType ??
          primaryMetadata?.type ??
          null;
        mutationPayload.type = inferMessageTypeFromMime(mime ?? undefined);
        mutationPayload.mediaUrl = primaryAttachment?.mediaUrl ?? primaryMetadata?.mediaUrl;
        mutationPayload.mediaMimeType = mime ?? undefined;
        mutationPayload.mediaFileName =
          primaryAttachment?.fileName ??
          primaryAttachment?.mediaFileName ??
          primaryAttachment?.name ??
          primaryMetadata?.fileName ??
          undefined;
        if (normalizedCaption) {
          mutationPayload.caption = normalizedCaption;
        }
      } else if (normalizedCaption) {
        mutationPayload.caption = normalizedCaption;
      }

      controller.sendMessageMutation.mutate(mutationPayload, {
        onSuccess: (result: any) => {
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
      controller.notesMutation.mutate(
        { ticketId: controller.selectedTicketId, body },
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

      const payload = {
        ticketId: controller.selectedTicketId,
        status: outcome === 'won' ? 'RESOLVED' : 'CLOSED',
        reason,
      };

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
      controller.assignMutation.mutate(
        { ticketId: ticket?.id ?? controller.selectedTicketId, userId: currentUser.id },
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
    if (!controller.queueAlerts?.length) {
      return;
    }
    const [latest] = controller.queueAlerts;
    if (lastQueueAlertRef.current === latest.timestamp) {
      return;
    }
    lastQueueAlertRef.current = latest.timestamp;
    toast.warning('🚨 Fila padrão ausente', {
      description: 'Nenhuma fila ativa foi encontrada para o tenant. Configure em Configurações → Filas para destravar o atendimento inbound.',
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
    <WhatsAppInstancesProvider autoRefresh={false} initialFetch={false}>
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
