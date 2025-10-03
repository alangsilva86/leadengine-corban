import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { getTenantId } from '@/lib/auth.js';
import InboxPanel from './components/SidebarInbox/InboxPanel.jsx';
import ConversationArea from './components/ConversationArea/ConversationArea.jsx';
import DetailsPanel from './components/DetailsPanel/DetailsPanel.jsx';
import useChatController from './hooks/useChatController.js';
import './styles/index.css';

export const ChatCommandCenter = ({ tenantId: tenantIdProp, currentUser }) => {
  const tenantId = tenantIdProp ?? getTenantId() ?? 'demo-tenant';

  const controller = useChatController({ tenantId, currentUser });

  const sendMessage = (content) => {
    controller.sendMessageMutation.mutate(
      { ticketId: controller.selectedTicketId, content },
      {
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
      toast.error('Não foi possível atribuir', { description: 'Usuário atual não identificado.' });
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

  useEffect(() => {
    if (!controller.queueAlerts?.length) {
      return;
    }
    const [latest] = controller.queueAlerts;
    toast.warning('Configure a fila padrão para receber mensagens', {
      description: 'Nenhuma fila ativa foi encontrada. Acesse Configurações > Filas para habilitar.',
    });
  }, [controller.queueAlerts]);

  return (
    <div className="chat-command-center">
      <div className="h-full">
        <InboxPanel
          filters={filters}
          onFiltersChange={controller.setFilters}
          search={filters.search ?? ''}
          onSearchChange={controller.setSearch}
          onRefresh={() => controller.ticketsQuery.refetch()}
          loading={controller.ticketsQuery.isFetching}
          tickets={controller.tickets}
          selectedTicketId={controller.selectedTicketId}
          onSelectTicket={controller.selectTicket}
          metrics={metrics}
          typingAgents={controller.typingIndicator?.agentsTyping ?? []}
          onAssign={assignToMe}
          onTransfer={() => toast.info('Transferência', { description: 'Selecione o destino na futura implementação.' })}
          onMute={() => toast.info('Silenciar contato', { description: 'Funcionalidade disponível em breve.' })}
          onFollowUp={() => toast.info('Follow-up agendado', { description: 'Abrindo modal de follow-up em breve.' })}
          onMacro={() => toast.success('Macro aplicada')}
        />
      </div>

      <div className="flex h-full flex-col">
        <ConversationArea
          ticket={controller.selectedTicket}
          conversation={controller.conversation}
          messagesQuery={controller.messagesQuery}
          onSendMessage={sendMessage}
          onCreateNote={createNote}
          onMarkWon={markWon}
          onMarkLost={markLost}
          onAssign={() => assignToMe(controller.selectedTicket)}
          onGenerateProposal={() => toast.info('Gerador de proposta', { description: 'Integração com mini simulador em breve.' })}
          typingIndicator={controller.typingIndicator}
          quality={quality}
        />
      </div>

      <div className="h-full">
        <DetailsPanel
          ticket={controller.selectedTicket}
          onCreateNote={createNote}
          notesLoading={controller.notesMutation.isPending}
          onGenerateProposal={() => toast.info('Gerar minuta', { description: 'Integração com assinaturas em andamento.' })}
          onReopenWindow={() => toast.info('Reabrir janela sugerido', { description: 'Envie um template para retomar a conversa.' })}
          onOpenAudit={() => toast.info('Auditoria', { description: 'Export disponível no módulo de compliance.' })}
        />
      </div>
    </div>
  );
};

export default ChatCommandCenter;
