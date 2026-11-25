import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/page';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.jsx';
import { getFriendlyErrorMessage } from '@/lib/errors.js';
import ContactTaskDialog from '@/features/contacts/components/ContactTaskDialog.jsx';
import ContactTasks from '@/features/contacts/components/ContactTasks.jsx';
import {
  useCompleteContactTaskMutation,
  useContactDetailsQuery,
  useContactTasksQuery,
} from '@/features/contacts/hooks/useContactsApi.js';
import useLeadDetails from '../hooks/useLeadDetails';
import useLeadTimeline from '../hooks/useLeadTimeline';
import useMoveLeadStage from '../hooks/useMoveLeadStage';
import LeadStageTrack from './lead-stage/LeadStageTrack';
import LeadStageMenu, { LeadStageChip } from './lead-stage/LeadStageMenu';
import LeadHeader from './lead-drawer/LeadHeader';
import LeadTimeline from './lead-drawer/LeadTimeline';
import LeadActionList from './lead-drawer/LeadActionList';
import useCrmPermissions from '../state/permissions';
import { useCrmViewContext } from '../state/view-context';
import { formatBRL } from '../utils/labels';
import { getLeadStageLabel } from '../utils/lead-stage';

type LeadDrawerProps = {
  open: boolean;
  leadId: string | null;
  onOpenChange: (nextOpen: boolean) => void;
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h3 className="text-sm font-medium text-foreground">{title}</h3>
    {children}
  </section>
);

/** Painel lateral do lead: dados, ações reais (conversa, tarefa), tarefas do contato e atividades. */
const LeadDrawer = ({ open, leadId, onOpenChange }: LeadDrawerProps) => {
  const { toggleRealtime } = useCrmViewContext();
  const { canManageTasks } = useCrmPermissions();
  const [taskOpen, setTaskOpen] = useState(false);
  const { lead, isLoading: leadLoading, error: leadError, refetch } = useLeadDetails(leadId);
  const { timeline, isLoading: timelineLoading, error: timelineError, refetch: refetchTimeline } = useLeadTimeline(leadId);
  const contactId = lead?.contactId ?? null;
  const contactQuery = useContactDetailsQuery(contactId, { enabled: open });
  const tasksQuery = useContactTasksQuery(contactId, { enabled: open });
  const completeTask = useCompleteContactTaskMutation(contactId);
  const { moveLead, pendingLeadId } = useMoveLeadStage();

  useEffect(() => {
    if (open) {
      toggleRealtime(false);
      return () => toggleRealtime(true);
    }
    return undefined;
  }, [open, toggleRealtime]);

  const value = formatBRL(lead?.potentialValue);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="gap-3 border-b border-border p-4 pr-12">
          {leadLoading && !lead ? (
            <>
              <SheetTitle className="sr-only">Carregando lead</SheetTitle>
              <SheetDescription className="sr-only">Aguarde enquanto os dados do lead são carregados.</SheetDescription>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <SheetTitle className="text-lg">{lead?.name ?? 'Lead'}</SheetTitle>
              <SheetDescription className={lead ? 'sr-only' : undefined}>
                {lead ? [getLeadStageLabel(lead.stage), value].filter(Boolean).join(' · ') : 'Detalhes do lead'}
              </SheetDescription>
              {lead ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <LeadStageMenu
                      stage={lead.stage}
                      align="start"
                      label="Mover lead para"
                      onSelect={(stage) => void moveLead(lead, stage, { source: 'drawer' })}
                    >
                      <LeadStageChip stage={lead.stage} pending={pendingLeadId === lead.id} />
                    </LeadStageMenu>
                    {value ? <span className="text-sm font-medium tabular-nums text-foreground">{value}</span> : null}
                  </div>
                  <LeadStageTrack stage={lead.stage} className="max-w-xs" />
                </div>
              ) : null}
            </>
          )}
          {lead ? (
            <LeadActionList
              contactId={contactId}
              leadId={lead.id}
              onCreateTask={() => setTaskOpen(true)}
              canManageTasks={canManageTasks}
            />
          ) : null}
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {leadError ? (
            <ErrorState size="compact" title="Não foi possível carregar o lead" error={leadError} onRetry={() => void refetch()} />
          ) : lead ? (
            <LeadHeader lead={lead} contact={contactQuery.data ?? null} />
          ) : (
            <div className="grid grid-cols-2 gap-3" aria-busy="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          )}

          {contactId ? (
            <Section title="Tarefas">
              <ContactTasks
                tasks={tasksQuery.data ?? []}
                isLoading={tasksQuery.isLoading}
                error={tasksQuery.error}
                onRetry={() => void tasksQuery.refetch()}
                onCreateTask={() => setTaskOpen(true)}
                completingId={completeTask.isPending ? completeTask.variables?.taskId : null}
                onCompleteTask={(task: { id: string }) =>
                  completeTask.mutate(
                    { taskId: task.id },
                    {
                      onSuccess: () => toast.success('Tarefa concluída.'),
                      onError: (error: unknown) => toast.error(getFriendlyErrorMessage(error, 'Não foi possível concluir a tarefa.')),
                    }
                  )
                }
              />
            </Section>
          ) : null}

          <Section title="Atividades">
            {timelineLoading ? (
              <Skeleton className="h-24 w-full rounded-md" />
            ) : timelineError ? (
              <ErrorState size="compact" title="Histórico indisponível" error={timelineError} onRetry={() => void refetchTimeline()} />
            ) : (
              <LeadTimeline events={timeline} />
            )}
          </Section>
        </div>

        {contactId ? (
          <ContactTaskDialog
            open={taskOpen}
            onOpenChange={setTaskOpen}
            contact={{ id: contactId, name: lead?.name }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export default LeadDrawer;
