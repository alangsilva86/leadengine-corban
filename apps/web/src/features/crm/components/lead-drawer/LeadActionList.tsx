import { Button } from '@/components/ui/button.jsx';
import { Pencil, CheckCircle2, CalendarPlus, Send } from 'lucide-react';

type LeadActionListProps = {
  onMarkConnected?: () => void;
  onScheduleFollowUp?: () => void;
  onSendMessage?: () => void;
  onEditLead?: () => void;
  busy?: boolean;
  canManageTasks?: boolean;
  canEditLead?: boolean;
};

const LeadActionList = ({
  onMarkConnected,
  onScheduleFollowUp,
  onSendMessage,
  onEditLead,
  busy = false,
  canManageTasks = true,
  canEditLead = true,
}: LeadActionListProps) => (
  <div className="flex flex-wrap gap-2">
    <Button type="button" size="sm" onClick={onMarkConnected} disabled={busy || !canManageTasks}>
      <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como contato realizado
    </Button>
    <Button type="button" size="sm" variant="outline" onClick={onScheduleFollowUp} disabled={busy || !canManageTasks}>
      <CalendarPlus className="mr-2 h-4 w-4" /> Agendar follow-up
    </Button>
    <Button type="button" size="sm" variant="secondary" onClick={onSendMessage} disabled={busy || !canManageTasks}>
      <Send className="mr-2 h-4 w-4" /> Enviar mensagem
    </Button>
    <Button type="button" size="sm" variant="ghost" onClick={onEditLead} disabled={busy || !canEditLead}>
      <Pencil className="mr-2 h-4 w-4" /> Editar lead
    </Button>
  </div>
);

export default LeadActionList;
