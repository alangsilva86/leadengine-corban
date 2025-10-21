import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getTenantId } from '@/lib/auth.js';
import { apiPost } from '@/lib/api.js';
import ConversationArea from './components/ConversationArea/ConversationArea.jsx';
import DetailsPanel from './components/DetailsPanel/DetailsPanel.jsx';
import InboxAppShell from './components/layout/InboxAppShell.jsx';
import QueueList from './components/QueueList/QueueList.jsx';
import FilterToolbar from './components/FilterToolbar/FilterToolbar.jsx';
import useChatController from './hooks/useChatController.js';
import { resolveWhatsAppErrorCopy } from '../whatsapp/utils/whatsapp-error-codes.js';
import ManualConversationDialog from './components/ManualConversationDialog.jsx';
import { useManualConversationLauncher } from './hooks/useManualConversationLauncher.js';
import emitInboxTelemetry from './utils/telemetry.js';

const MANUAL_CONVERSATION_TOAST_ID = 'manual-conversation';

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

export const ChatCommandCenter = ({ tenantId: tenantIdProp, currentUser }) => {
  const tenantId = tenantIdProp ?? getTenantId() ?? 'demo-tenant';

  const controller = useChatController({ tenantId, currentUser });
  const {
    launch: launchManualConversation,
    isPending: manualConversationPending,
    isAvailable: manualConversationAvailable,
    unavailableReason: manualConversationUnavailableReason,
  } = useManualConversationLauncher();
  const [manualConversationOpen, setManualConversationOpen] = useState(false);
  const [whatsAppUnavailable, setWhatsAppUnavailable] = useState(null);

  const applyWhatsAppErrorCopy = useCallback((code, fallbackMessage) => {
    const copy = resolveWhatsAppErrorCopy(code, fallbackMessage);
    setWhatsAppUnavailable(copy.code === 'BROKER_NOT_CONFIGURED' ? copy : null);
    return copy;
  }, []);

  useEffect(() => {
    setWhatsAppUnavailable(null);
  }, [controller.selectedTicketId]);

  const handleManualConversationSubmit = useCallback(
    async (payload) => {
      if (!manualConversationAvailable) {
        const message =
          manualConversationUnavailableReason ??
          'Fluxo manual indisponível no momento. Utilize os canais oficiais de abertura ou tente novamente em instantes.';
        toast.error(message, {
          id: MANUAL_CONVERSATION_TOAST_ID,
          position: 'bottom-right',
        });
        throw new Error(message);
      }

      toast.loading('Iniciando conversa…', {
        id: MANUAL_CONVERSATION_TOAST_ID,
        position: 'bottom-right',
      });

      try {
        const result = await launchManualConversation(payload);
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Não foi possível iniciar a conversa.';
        const description =
          manualConversationUnavailableReason &&
          manualConversationUnavailableReason !== message
            ? manualConversationUnavailableReason
            : undefined;
        toast.error(message, {
          id: MANUAL_CONVERSATION_TOAST_ID,
          description,
          position: 'bottom-right',
        });
        throw error;
      }
    },
    [
      launchManualConversation,
      manualConversationAvailable,
      manualConversationUnavailableReason,
    ]
  );

  const handleManualConversationSuccess = useCallback(
    async (result) => {
      toast.success('Conversa iniciada', {
        id: MANUAL_CONVERSATION_TOAST_ID,
        duration: 2500,
        position: 'bottom-right',
      });

      setManualConversationOpen(false);

      const ticketId = result?.ticketId ?? result?.ticket?.id ?? result?.message?.ticketId ?? null;

      try {
        await controller.ticketsQuery?.refetch?.({ cancelRefetch: false });
      } catch (error) {
        console.error('Falha ao recarregar tickets após iniciar conversa manual', error);
      }

      if (ticketId && typeof controller.selectTicket === 'function') {
        controller.selectTicket(ticketId);
      }
    },
    [controller.selectTicket, controller.ticketsQuery]
  );

  const sendMessage = ({ content, attachments = [], template, caption }) => {
    const trimmed = (content ?? '').trim();
    if (!trimmed && attachments.length === 0 && !template) {
      return;
    }

    const metadata = {};

    if (attachments.length > 0) {
      const normalizedAttachments = attachments.map((file) => {
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
        const normalizedRecord = Object.fromEntries(
          Object.entries(record).filter(([, value]) => value !== undefined && value !== null)
        );
        return normalizedRecord;
      });

      const filtered = normalizedAttachments.filter((entry) => Object.keys(entry).length > 0);
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
    const normalizedCaption = hasAttachments
      ? caption ?? (trimmed.length > 0 ? trimmed : undefined)
      : caption;

    const [primaryAttachment] = attachments;
    const primaryMetadata = metadata.attachments?.[0];

    const mutationPayload = {
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

    controller.sendMessageMutation.mutate(
      mutationPayload,
      {
        onSuccess: (result) => {
          const error = result?.error;
          if (error) {
            const copy = applyWhatsAppErrorCopy(error?.payload?.code ?? error?.code, error?.message);
            toast.error(copy.title ?? 'Falha ao enviar mensagem', {
              description: copy.description ?? error?.message ?? 'Não foi possível enviar a mensagem.',
            });
            return;
          }
          setWhatsAppUnavailable(null);
          emitInboxTelemetry('chat.outbound_message', {
            ticketId: controller.selectedTicketId,
            hasTemplate: Boolean(template),
            hasAttachments,
          });
        },
        onError: (error) => {
          const fallbackMessage = error?.message ?? 'Erro inesperado ao enviar';
          const copy = applyWhatsAppErrorCopy(error?.payload?.code ?? error?.code, fallbackMessage);
          toast.error(copy.title ?? 'Falha ao enviar mensagem', {
            description: copy.description ?? fallbackMessage,
          });
          emitInboxTelemetry('chat.outbound_error', {
            ticketId: controller.selectedTicketId,
            error: error?.message,
            hasTemplate: Boolean(template),
          });
        },
      }
    );
  };

  const createNote = (body) => {
    controller.notesMutation.mutate(
      { ticketId: controller.selectedTicketId, body },
      {
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
      }
    );
  };

  const registerResult = async ({ outcome, reason }) => {
    if (!controller.selectedTicketId) return;

    const payload = {
      ticketId: controller.selectedTicketId,
      status: outcome === 'won' ? 'RESOLVED' : 'CLOSED',
      reason,
    };

    try {
      await controller.statusMutation.mutateAsync(payload);
      toast.success('Resultado registrado.');
    } catch (error) {
      toast.error('Não foi possível concluir. Tente novamente.', {
        description: error?.message,
      });
      throw error;
    }
  };

  const assignToMe = (ticket) => {
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
        onError: (error) => toast.error('Erro ao atribuir ticket', { description: error?.message }),
      }
    );
  };

  const handleGenerateProposal = () => {
    toast.success('Proposta gerada.');
  };

  const handleScheduleFollowUp = () => {
    toast.info('Agendar follow-up', {
      description: 'Conecte um calendário para programar o próximo contato.',
    });
    emitInboxTelemetry('chat.follow_up.requested', {
      ticketId: controller.selectedTicketId,
    });
  };

  const handleSendTemplate = (template) => {
    if (!template) return;
    sendMessage({ content: template.body ?? template.content ?? '', template });
  };

  const handleCreateNextStep = async ({ description, dueAt }) => {
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
    } catch (error) {
      const message = error?.message ?? 'Não foi possível criar o próximo passo.';
      toast.error('Não foi possível criar o próximo passo', { description: message });
      emitInboxTelemetry('chat.next_step.error', {
        ticketId,
        contactId,
        message,
      });
      throw error;
    }
  };

  const handleRegisterCallResult = ({ outcome, notes }) => {
    const ticketId = controller.selectedTicketId;
    emitInboxTelemetry('chat.call.result_logged', {
      ticketId,
      outcome,
    });
    toast.success('Resultado da chamada registrado');
    if (notes) {
      createNote(`📞 ${outcome}: ${notes}`);
    }
  };

  const metrics = controller.metrics;
  const filters = controller.filters;

  const lastQueueAlertRef = useRef(null);

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

  const handleManualSync = () => {
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
  };

  useEffect(() => {
    if (!manualConversationAvailable) {
      setManualConversationOpen(false);
    }
  }, [manualConversationAvailable]);

  return (
    <>
      {manualConversationAvailable ? (
        <ManualConversationDialog
          open={manualConversationOpen}
          onOpenChange={setManualConversationOpen}
          onSubmit={handleManualConversationSubmit}
          onSuccess={handleManualConversationSuccess}
          isSubmitting={manualConversationPending}
        />
      ) : null}

      <div className="flex flex-1 min-h-0 w-full">
        <InboxAppShell
          currentUser={currentUser}
          sidebar={
            <QueueList
              tickets={controller.tickets}
              selectedTicketId={controller.selectedTicketId}
              onSelectTicket={controller.selectTicket}
              loading={controller.ticketsQuery.isFetching}
              onRefresh={handleManualSync}
              typingAgents={controller.typingIndicator?.agentsTyping ?? []}
              metrics={metrics}
            />
          }
          context={
            <DetailsPanel
              ticket={controller.selectedTicket}
              onCreateNote={createNote}
              notesLoading={controller.notesMutation.isPending}
              onSendTemplate={handleSendTemplate}
              onCreateNextStep={handleCreateNextStep}
              onRegisterCallResult={handleRegisterCallResult}
              onGenerateProposal={() =>
                toast.info('Gerar minuta', { description: 'Integração com assinaturas em andamento.' })
              }
              onReopenWindow={() =>
                toast.info('Reabrir janela sugerido', { description: 'Envie um template para retomar a conversa.' })
              }
              onOpenAudit={() =>
                toast.info('Auditoria', { description: 'Export disponível no módulo de compliance.' })
              }
            />
          }
          defaultContextOpen
          toolbar={
            <FilterToolbar
              search={filters.search ?? ''}
              onSearchChange={controller.setSearch}
              filters={filters}
              onFiltersChange={controller.setFilters}
              loading={controller.ticketsQuery.isFetching}
              onRefresh={handleManualSync}
              onStartManualConversation={
                manualConversationAvailable
                  ? () => setManualConversationOpen(true)
                  : undefined
              }
              manualConversationPending={manualConversationPending}
              manualConversationUnavailableReason={manualConversationUnavailableReason}
            />
          }
        >
          <ConversationArea
            ticket={controller.selectedTicket}
            conversation={controller.conversation}
            messagesQuery={controller.messagesQuery}
            onSendMessage={sendMessage}
            onCreateNote={createNote}
            onRegisterResult={registerResult}
            onAssign={() => assignToMe(controller.selectedTicket)}
            onGenerateProposal={handleGenerateProposal}
            onScheduleFollowUp={handleScheduleFollowUp}
            isRegisteringResult={controller.statusMutation.isPending}
            typingIndicator={controller.typingIndicator}
            isSending={controller.sendMessageMutation.isPending}
            sendError={controller.sendMessageMutation.error}
            composerDisabled={Boolean(whatsAppUnavailable)}
            composerDisabledReason={whatsAppUnavailable}
          />
        </InboxAppShell>
      </div>
    </>
  );
};

export default ChatCommandCenter;
