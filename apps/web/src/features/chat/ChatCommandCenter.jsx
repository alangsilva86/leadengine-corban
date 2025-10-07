import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { getTenantId } from '@/lib/auth.js';
import ConversationArea from './components/ConversationArea/ConversationArea.jsx';
import DetailsPanel from './components/DetailsPanel/DetailsPanel.jsx';
import InboxAppShell from './components/layout/InboxAppShell.jsx';
import QueueList from './components/QueueList/QueueList.jsx';
import FilterToolbar from './components/FilterToolbar/FilterToolbar.jsx';
import useChatController from './hooks/useChatController.js';
import { resolveWhatsAppErrorCopy } from '../whatsapp/utils/whatsapp-error-codes.js';

export const ChatCommandCenter = ({ tenantId: tenantIdProp, currentUser }) => {
  const tenantId = tenantIdProp ?? getTenantId() ?? 'demo-tenant';

  const controller = useChatController({ tenantId, currentUser });

  const sendMessage = ({ content, attachments = [], template }) => {
    const trimmed = (content ?? '').trim();
    if (!trimmed && attachments.length === 0) {
      return;
    }

    const metadata = {};

    if (attachments.length > 0) {
      metadata.attachments = attachments.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      }));
    }

    if (template) {
      metadata.template = {
        id: template.id ?? template.name ?? 'template',
        label: template.label ?? template.name ?? template.id ?? 'template',
      };
    }

    controller.sendMessageMutation.mutate(
      {
        ticketId: controller.selectedTicketId,
        content: trimmed,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
      {
        onSuccess: (result) => {
          const error = result?.error;
          if (error) {
            const copy = resolveWhatsAppErrorCopy(error.code, error.message);
            toast.error(copy.title ?? 'Falha ao enviar mensagem', {
              description: copy.description ?? error.message ?? 'Não foi possível enviar a mensagem.',
            });
          }
        },
        onError: (error) => {
          toast.error('Falha ao enviar mensagem', {
            description: error?.message ?? 'Erro inesperado ao enviar',
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
        },
      }
    );
  };

  const markWon = () => {
    controller.statusMutation.mutate(
      { ticketId: controller.selectedTicketId, status: 'RESOLVED', reason: 'Ganho no WhatsApp' },
      {
        onSuccess: () => toast.success('Ticket marcado como ganho'),
        onError: (error) => toast.error('Erro ao atualizar status', { description: error?.message }),
      }
    );
  };

  const markLost = () => {
    controller.statusMutation.mutate(
      { ticketId: controller.selectedTicketId, status: 'CLOSED', reason: 'Sem interesse' },
      {
        onSuccess: () => toast.success('Ticket marcado como perda'),
        onError: (error) => toast.error('Erro ao atualizar status', { description: error?.message }),
      }
    );
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

  const metrics = controller.metrics;
  const filters = controller.filters;

  const quality = useMemo(() => controller.whatsAppLimits.data?.quality, [controller.whatsAppLimits.data]);
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

  return (
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
      defaultContextOpen={false}
      toolbar={
        <FilterToolbar
          search={filters.search ?? ''}
          onSearchChange={controller.setSearch}
          filters={filters}
          onFiltersChange={controller.setFilters}
          loading={controller.ticketsQuery.isFetching}
          onRefresh={handleManualSync}
        />
      }
    >
      <div className="flex h-full flex-1 justify-center bg-gradient-to-br from-slate-950/60 via-slate-950 to-slate-950/80">
        <div className="flex h-full w-full max-w-6xl flex-col gap-4 px-4 pb-6 pt-4">
          <ConversationArea
            ticket={controller.selectedTicket}
            conversation={controller.conversation}
            messagesQuery={controller.messagesQuery}
            onSendMessage={sendMessage}
            onCreateNote={createNote}
          onMarkWon={markWon}
          onMarkLost={markLost}
          onAssign={() => assignToMe(controller.selectedTicket)}
          onGenerateProposal={() =>
            toast.info('Gerador de proposta', { description: 'Integração com mini simulador em breve.' })
          }
          typingIndicator={controller.typingIndicator}
          quality={quality}
          isSending={controller.sendMessageMutation.isPending}
          sendError={controller.sendMessageMutation.error}
        />
        </div>
      </div>
    </InboxAppShell>
  );
};

export default ChatCommandCenter;
