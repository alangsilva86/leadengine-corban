import { useEffect, useMemo } from 'react';
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
import LeadActionList from './lead-drawer/LeadActionList';
import LeadTimeline from './lead-drawer/LeadTimeline';
import LeadTaskList from './lead-drawer/LeadTaskList';
import { useCrmViewContext } from '../state/view-context';
import useCrmPermissions from '../state/permissions';
import emitCrmTelemetry from '../utils/telemetry';

type LeadDrawerProps = {
  open: boolean;
  leadId: string | null;
  onOpenChange: (nextOpen: boolean) => void;
};

const LeadDrawer = ({ open, leadId, onOpenChange }: LeadDrawerProps) => {
  const { toggleRealtime } = useCrmViewContext();
  const permissions = useCrmPermissions();
  const { lead, isLoading: leadLoading } = useLeadDetails(leadId);
  const { timeline, isLoading: timelineLoading } = useLeadTimeline(leadId);
  const { tasks, isLoading: tasksLoading } = useLeadTasks(leadId);

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
            {ready && lead ? <LeadHeader lead={lead} /> : <div className="h-32 animate-pulse rounded-lg bg-muted/40" />}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Ações rápidas</h3>
              <LeadActionList
                onMarkConnected={() => emitCrmTelemetry('crm.lead.open', { action: 'mark_connected', leadId })}
                onScheduleFollowUp={() => emitCrmTelemetry('crm.lead.open', { action: 'schedule_follow_up', leadId })}
                onSendMessage={() => emitCrmTelemetry('crm.lead.open', { action: 'send_message', leadId })}
                onEditLead={() => emitCrmTelemetry('crm.lead.open', { action: 'edit_lead', leadId })}
                canManageTasks={permissions.canManageTasks}
                canEditLead={permissions.canEditLead}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
              {timelineLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted/40" /> : <LeadTimeline events={timeline} />}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Próximas tarefas</h3>
              {tasksLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted/40" /> : <LeadTaskList tasks={tasks} />}
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
            <Button
              type="button"
              onClick={() => emitCrmTelemetry('crm.insights.navigate', { targetView: 'list', entry: 'drawer_footer', leadId })}
            >
              Ver detalhes completos
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default LeadDrawer;
