import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, MessageCircle, MoreHorizontal, Pencil, UserX } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState, ErrorState, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { getFriendlyErrorMessage } from '@/lib/errors.js';
import useCrmPermissions from '@/features/crm/state/permissions';
import { buildInboxHref, formatRelativeShort } from '@/features/crm/utils/labels';
import ContactSummary from '../components/ContactSummary.jsx';
import ContactTimeline from '../components/ContactTimeline.jsx';
import ContactTasks from '../components/ContactTasks.jsx';
import ContactOpportunities from '../components/ContactOpportunities.jsx';
import InteractionComposer from '../components/InteractionComposer.jsx';
import ContactQuickEditDrawer from '../components/ContactQuickEditDrawer.jsx';
import ContactTaskDialog from '../components/ContactTaskDialog.jsx';
import useContactsLiveUpdates from '../hooks/useContactsLiveUpdates.js';
import {
  useCompleteContactTaskMutation,
  useContactDetailsQuery,
  useContactInteractionMutation,
  useContactInteractionsQuery,
  useContactLeadIndex,
  useContactOpportunitiesQuery,
  useContactTasksQuery,
  useUpdateContactMutation,
} from '../hooks/useContactsApi.js';
import { formatPhone } from '../utils/format.js';

const TabCount = ({ value }) =>
  typeof value === 'number' && value > 0 ? (
    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 tabular-nums">
      {value}
    </Badge>
  ) : null;

const ConversationsPanel = ({ contact }) => {
  const openTickets = Number(contact?.openTickets) || 0;
  const lastInteraction = formatRelativeShort(contact?.lastInteractionAt);
  return (
    <EmptyState
      size="compact"
      icon={MessageCircle}
      title={
        openTickets === 0
          ? 'Nenhuma conversa em aberto'
          : openTickets === 1
            ? '1 conversa em aberto'
            : `${openTickets} conversas em aberto`
      }
      description={
        lastInteraction
          ? `As mensagens ficam no Inbox. Última interação ${lastInteraction}.`
          : 'As mensagens de WhatsApp deste contato ficam no Inbox.'
      }
      action={
        <Button asChild size="sm" variant="outline">
          <Link to={buildInboxHref(contact?.id)}>
            <MessageCircle aria-hidden="true" />
            Abrir conversa
          </Link>
        </Button>
      }
    />
  );
};

const ContactDetailsPage = () => {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { canViewSensitiveData } = useCrmPermissions();
  const [isEditOpen, setEditOpen] = useState(false);
  const [isTaskOpen, setTaskOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('conversations');

  const detailsQuery = useContactDetailsQuery(contactId);
  const interactionsQuery = useContactInteractionsQuery(contactId);
  const tasksQuery = useContactTasksQuery(contactId);
  const opportunitiesQuery = useContactOpportunitiesQuery(contactId);
  const leadIndexQuery = useContactLeadIndex();
  const updateMutation = useUpdateContactMutation(contactId);
  const interactionMutation = useContactInteractionMutation(contactId);
  const completeTask = useCompleteContactTaskMutation(contactId);

  useContactsLiveUpdates({ contactId, enabled: Boolean(contactId) });

  const contact = detailsQuery.data;
  const tasks = tasksQuery.data ?? [];
  const pendingTasks = tasks.filter((task) => task.status === 'PENDING').length;
  const interactions = interactionsQuery.data ?? [];
  const opportunities = opportunitiesQuery.data ?? [];

  const handleUpdateContact = (payload) => {
    updateMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Contato atualizado.');
        setEditOpen(false);
      },
      onError: (error) => toast.error(getFriendlyErrorMessage(error, 'Não foi possível atualizar o contato.')),
    });
  };

  const handleRegisterInteraction = async (payload) => {
    try {
      await interactionMutation.mutateAsync(payload);
      toast.success('Interação registrada no histórico.');
      return true;
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Não foi possível registrar a interação.'));
      return false;
    }
  };

  const handleCompleteTask = (task) => {
    if (!task?.id) return;
    completeTask.mutate(
      { taskId: task.id },
      {
        onSuccess: () => toast.success('Tarefa concluída.'),
        onError: (error) => toast.error(getFriendlyErrorMessage(error, 'Não foi possível concluir a tarefa.')),
      }
    );
  };

  const backLink = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
      <Link to="/contacts">
        <ArrowLeft aria-hidden="true" />
        Contatos
      </Link>
    </Button>
  );

  if (detailsQuery.isError) {
    const notFound = detailsQuery.error?.status === 404;
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <div className="rounded-lg border border-border bg-surface">
          {notFound ? (
            <EmptyState
              icon={UserX}
              title="Contato não encontrado"
              description="Ele pode ter sido mesclado com outro contato ou removido."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/contacts">Ver contatos</Link>
                </Button>
              }
            />
          ) : (
            <ErrorState title="Não foi possível carregar o contato" error={detailsQuery.error} onRetry={() => detailsQuery.refetch()} />
          )}
        </div>
      </div>
    );
  }

  const phone = formatPhone(contact?.phone);
  const lastInteraction = formatRelativeShort(contact?.lastInteractionAt);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={contact?.name || (detailsQuery.isLoading ? <span className="inline-block h-8 w-56 animate-pulse rounded-md bg-muted align-middle" aria-label="Carregando" /> : 'Contato sem nome')}
        documentTitle={contact?.name || 'Contato'}
        meta={
          contact ? (
            <span className="tabular-nums">
              {[phone, lastInteraction ? `última interação ${lastInteraction}` : 'sem interações registradas']
                .filter(Boolean)
                .join(' · ')}
            </span>
          ) : null
        }
        actions={
          <>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon" aria-label="Mais ações" disabled={!contact}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Mais ações</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil />
                  Editar contato
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="outline" onClick={() => setTaskOpen(true)} disabled={!contact}>
              <CalendarPlus aria-hidden="true" />
              Nova tarefa
            </Button>
            <Button type="button" onClick={() => navigate(buildInboxHref(contactId))} disabled={!contact}>
              <MessageCircle aria-hidden="true" />
              Abrir conversa
            </Button>
          </>
        }
      />

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <ContactSummary
          contact={contact}
          lead={leadIndexQuery.data?.index?.get(contactId) ?? null}
          isLoading={detailsQuery.isLoading}
          canViewSensitiveData={canViewSensitiveData}
        />

        <div className="min-w-0 rounded-lg border border-border bg-surface">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
            <div className="overflow-x-auto border-b border-border px-2 pt-2">
              <TabsList className="h-auto w-max justify-start gap-1 bg-transparent p-0">
                {[
                  { value: 'conversations', label: 'Conversas', count: Number(contact?.openTickets) || 0 },
                  { value: 'opportunities', label: 'Oportunidades', count: opportunities.length },
                  { value: 'tasks', label: 'Tarefas', count: pendingTasks },
                  { value: 'history', label: 'Histórico' },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-9 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent"
                  >
                    {tab.label}
                    <TabCount value={tab.count} />
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="conversations" className="p-4">
              <ConversationsPanel contact={contact} />
            </TabsContent>
            <TabsContent value="opportunities" className="p-4">
              <ContactOpportunities
                contactId={contactId}
                items={opportunities}
                isLoading={opportunitiesQuery.isLoading}
                error={opportunitiesQuery.error}
                onRetry={() => opportunitiesQuery.refetch()}
              />
            </TabsContent>
            <TabsContent value="tasks" className="p-4">
              <ContactTasks
                tasks={tasks}
                isLoading={tasksQuery.isLoading}
                error={tasksQuery.error}
                onRetry={() => tasksQuery.refetch()}
                onCreateTask={() => setTaskOpen(true)}
                onCompleteTask={handleCompleteTask}
                completingId={completeTask.isPending ? completeTask.variables?.taskId : null}
              />
            </TabsContent>
            <TabsContent value="history" className="space-y-5 p-4">
              <InteractionComposer onSubmit={handleRegisterInteraction} isSubmitting={interactionMutation.isPending} />
              <ContactTimeline
                items={interactions}
                isLoading={interactionsQuery.isLoading}
                error={interactionsQuery.error}
                onRetry={() => interactionsQuery.refetch()}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ContactQuickEditDrawer
        open={isEditOpen}
        onOpenChange={setEditOpen}
        contact={contact}
        onSubmit={handleUpdateContact}
        isSubmitting={updateMutation.isPending}
        canViewSensitiveData={canViewSensitiveData}
      />
      <ContactTaskDialog
        open={isTaskOpen}
        onOpenChange={setTaskOpen}
        contact={contact ? { id: contactId, name: contact.name } : null}
        onCreated={() => setActiveTab('tasks')}
      />
    </div>
  );
};

export default ContactDetailsPage;
