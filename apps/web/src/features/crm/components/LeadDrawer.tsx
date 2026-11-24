import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer.jsx';
import { Button } from '@/components/ui/button.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import useLeadDetails from '../hooks/useLeadDetails';
import useLeadTimeline from '../hooks/useLeadTimeline';
import useLeadTasks from '../hooks/useLeadTasks';
import LeadHeader from './lead-drawer/LeadHeader';
import LeadTimeline from './lead-drawer/LeadTimeline';
import LeadTaskList from './lead-drawer/LeadTaskList';
import { useCrmViewContext } from '../state/view-context';

type LeadDrawerProps = {
  open: boolean;
  leadId: string | null;
  onOpenChange: (nextOpen: boolean) => void;
};

const LeadDrawer = ({ open, leadId, onOpenChange }: LeadDrawerProps) => {
  const { toggleRealtime } = useCrmViewContext();
  const { lead, isLoading: leadLoading, error: leadError } = useLeadDetails(leadId);
  const { timeline, isLoading: timelineLoading, error: timelineError } = useLeadTimeline(leadId);
  const { tasks, isLoading: tasksLoading, error: tasksError } = useLeadTasks(leadId);

  useEffect(() => {
    if (open) {
      toggleRealtime(false);
      return () => toggleRealtime(true);
    }
    return undefined;
  }, [open, toggleRealtime]);

  const ready = useMemo(() => Boolean(lead) && !leadLoading, [lead, leadLoading]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="flex h-full max-h-full w-full flex-col sm:max-w-2xl">
        <DrawerHeader className="border-b border-border/60 pb-4">
          <DrawerTitle>Lead</DrawerTitle>
          <DrawerDescription>Detalhes, histórico e próximos passos.</DrawerDescription>
        </DrawerHeader>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-6 p-6">
            {ready && lead && <LeadHeader lead={lead} />}
            {leadLoading && <p role="status">Carregando lead…</p>}
            {leadError && <p role="alert">Não foi possível carregar os detalhes do lead.</p>}
            {lead?.contactId && (
              <Button asChild><Link to={`/crm/opportunities?${new URLSearchParams({ contactId: lead.contactId, leadId: lead.id })}`}>
                Abrir oportunidades do contato
              </Link></Button>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
              {timelineLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted/40" /> : timelineError ? <p role="alert">Histórico indisponível.</p> : <LeadTimeline events={timeline} />}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Próximas tarefas</h3>
              {tasksLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted/40" /> : tasksError ? <p role="alert">Tarefas indisponíveis.</p> : <LeadTaskList tasks={tasks} />}
            </section>
          </div>
        </ScrollArea>
        <DrawerFooter className="flex items-center justify-between border-t border-border/60 bg-muted/20 py-4">
          <span className="text-xs text-muted-foreground">ID do lead: {leadId ?? 'desconhecido'}</span>
          <div className="flex items-center gap-2">
            <DrawerClose asChild>
              <Button type="button" variant="outline">
                Fechar
              </Button>
            </DrawerClose>

          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default LeadDrawer;
