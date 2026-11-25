import { Link } from 'react-router-dom';
import { Briefcase, CalendarPlus, MessageCircle, MoreHorizontal, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { buildInboxHref } from '../../utils/labels';

type LeadActionListProps = {
  contactId?: string | null;
  leadId?: string | null;
  onCreateTask?: () => void;
  canManageTasks?: boolean;
};

/**
 * Ações do lead que existem de verdade na API:
 * abrir a conversa no Inbox, criar tarefa, ver o contato e as oportunidades.
 * (A etapa muda pelo chip "Mover para…" no cabeçalho do painel.)
 */
const LeadActionList = ({ contactId, leadId, onCreateTask, canManageTasks = true }: LeadActionListProps) => {
  const opportunitiesHref = contactId
    ? `/crm/opportunities?${new URLSearchParams({ contactId, ...(leadId ? { leadId } : {}) })}`
    : '/crm/opportunities';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm" disabled={!contactId}>
        <Link to={buildInboxHref(contactId)}>
          <MessageCircle aria-hidden="true" />
          Abrir conversa
        </Link>
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onCreateTask} disabled={!contactId || !canManageTasks}>
        <CalendarPlus aria-hidden="true" />
        Nova tarefa
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Mais ações do lead" className="text-muted-foreground">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {contactId ? (
            <DropdownMenuItem asChild>
              <Link to={`/contacts/${contactId}`}>
                <UserRound />
                Ver contato
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link to={opportunitiesHref}>
              <Briefcase />
              Oportunidades do contato
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default LeadActionList;
