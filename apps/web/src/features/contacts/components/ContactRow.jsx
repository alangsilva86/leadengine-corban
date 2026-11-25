import { memo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, MessageCircle, MoreHorizontal, Pencil, UserRound } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { TableCell, TableRow } from '@/components/ui/table.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import {
  formatBRL,
  formatDateTime,
  formatRelativeShort,
  getInitials,
} from '@/features/crm/utils/labels';
import LeadStageBadge from '@/features/crm/components/lead-stage/LeadStageBadge';
import { CONTACT_STATUS_LABELS, formatPhone } from '../utils/format.js';

const MAX_VISIBLE_TAGS = 2;

const isInteractiveTarget = (target) =>
  target instanceof Element && Boolean(target.closest('a,button,input,[role="checkbox"],[role="menuitem"],[data-row-interactive]'));

const ContactRowComponent = ({
  contact,
  lead,
  leadIndexReady = false,
  selected = false,
  onToggle,
  onOpenDetails,
  onOpenConversation,
  onCreateTask,
  onEdit,
}) => {
  const name = contact?.name?.trim() || 'Contato sem nome';
  const phone = formatPhone(contact?.phone);
  const tags = Array.isArray(contact?.tags) ? contact.tags.filter(Boolean) : [];
  const extraTags = tags.slice(MAX_VISIBLE_TAGS);
  const statusLabel = contact?.status && contact.status !== 'ACTIVE' ? CONTACT_STATUS_LABELS[contact.status] : null;
  const lastInteraction = formatRelativeShort(contact?.lastInteractionAt);
  const lastInteractionAbsolute = formatDateTime(contact?.lastInteractionAt);
  const leadValue = formatBRL(lead?.potentialValue);
  const openTickets = Number(contact?.openTickets) || 0;

  const handleRowClick = (event) => {
    if (isInteractiveTarget(event.target)) {
      return;
    }
    onOpenDetails?.(contact);
  };

  return (
    <TableRow
      data-state={selected ? 'selected' : undefined}
      className="group cursor-pointer border-border hover:bg-surface-hover data-[state=selected]:bg-primary-soft/60"
      onClick={handleRowClick}
    >
      <TableCell className="w-10 py-2 pr-0 pl-4">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle?.(contact.id)}
          aria-label={`Selecionar ${name}`}
        />
      </TableCell>

      <TableCell className="w-full max-w-0 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary-soft-foreground">
              {getInitials(contact?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                to={`/contacts/${contact.id}`}
                className="truncate font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {name}
              </Link>
              {openTickets > 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex size-2 shrink-0 rounded-full bg-whatsapp"
                      aria-label="Conversa em aberto"
                      role="img"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {openTickets === 1 ? '1 conversa em aberto' : `${openTickets} conversas em aberto`}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {contact?.isBlocked ? <Badge variant="destructive">Bloqueado</Badge> : null}
              {statusLabel ? <Badge variant="secondary">{statusLabel}</Badge> : null}
            </div>
            <p className="truncate text-xs text-muted-foreground tabular-nums">{phone ?? 'Sem telefone'}</p>
          </div>
        </div>
      </TableCell>

      <TableCell className="hidden py-2 md:table-cell">
        {lead ? (
          <div className="flex items-center gap-2">
            <LeadStageBadge stage={lead.stage} />
            {leadValue ? <span className="text-sm text-foreground tabular-nums">{leadValue}</span> : null}
          </div>
        ) : (
          <span className="text-subtle-foreground" aria-label={leadIndexReady ? 'Sem lead no funil' : 'Lead não carregado'}>
            —
          </span>
        )}
      </TableCell>

      <TableCell className="hidden py-2 lg:table-cell">
        {lead ? (
          lead.ownerName ? (
            <span className="text-sm text-foreground">{lead.ownerName}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Sem responsável</span>
          )
        ) : (
          <span className="text-subtle-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="hidden py-2 sm:table-cell">
        {lastInteraction ? (
          <time
            dateTime={new Date(contact.lastInteractionAt).toISOString()}
            title={lastInteractionAbsolute ?? undefined}
            className="text-sm text-muted-foreground tabular-nums"
          >
            {lastInteraction}
          </time>
        ) : (
          <span className="text-sm text-subtle-foreground">Sem interação</span>
        )}
      </TableCell>

      <TableCell className="hidden py-2 lg:table-cell">
        {tags.length === 0 ? (
          <span className="text-subtle-foreground">—</span>
        ) : (
          <div className="flex max-w-[220px] items-center gap-1">
            {tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
              <Badge key={tag} variant="secondary" className="max-w-[96px] truncate">
                {tag}
              </Badge>
            ))}
            {extraTags.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" tabIndex={0} data-row-interactive>
                    +{extraTags.length}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{extraTags.join(', ')}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        )}
      </TableCell>

      <TableCell className="w-12 py-2 pr-3 text-right">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Ações para ${name}`}
                  className={cn('text-muted-foreground', 'opacity-100 sm:opacity-60 sm:group-hover:opacity-100 sm:focus-visible:opacity-100')}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Mais ações</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => onOpenConversation?.(contact)}>
              <MessageCircle />
              Abrir conversa
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCreateTask?.(contact)}>
              <CalendarPlus />
              Nova tarefa
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit?.(contact)}>
              <Pencil />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onOpenDetails?.(contact)}>
              <UserRound />
              Ver contato
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

const ContactRow = memo(ContactRowComponent);

export default ContactRow;
