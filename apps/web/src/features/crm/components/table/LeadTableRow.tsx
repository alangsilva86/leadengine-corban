import { memo } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import type { LeadSummary } from '../../state/leads';
import {
  IDLE_TONE_CLASS,
  buildInboxHref,
  formatBRL,
  formatDateTime,
  formatRelativeShort,
  getIdleTone,
  getInitials,
  getSourceIcon,
  getSourceLabel,
} from '../../utils/labels';
import LeadStageBadge from '../lead-stage/LeadStageBadge';

type LeadTableRowProps = {
  lead: LeadSummary;
  onOpenDrawer: (leadId: string) => void;
};

const isInteractive = (target: EventTarget) =>
  target instanceof Element && Boolean(target.closest('a,button'));

const LeadTableRow = memo(({ lead, onOpenDrawer }: LeadTableRowProps) => {
  const sourceLabel = getSourceLabel(lead.source);
  const SourceIcon = getSourceIcon(lead.source);
  const relative = formatRelativeShort(lead.lastActivityAt);
  const value = formatBRL(lead.potentialValue);

  return (
    <TableRow
      className="cursor-pointer border-border hover:bg-surface-hover"
      onClick={(event: MouseEvent) => {
        if (!isInteractive(event.target)) onOpenDrawer(lead.id);
      }}
    >
      <TableCell className="w-full max-w-0 py-2 pl-4">
        <button
          type="button"
          className="max-w-full truncate text-left font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
          onClick={() => onOpenDrawer(lead.id)}
        >
          {lead.name}
        </button>
      </TableCell>
      <TableCell className="py-2">
        <LeadStageBadge stage={lead.stage} />
      </TableCell>
      <TableCell className="hidden py-2 md:table-cell">
        {sourceLabel ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <SourceIcon className="size-3.5" aria-hidden="true" />
            {sourceLabel}
          </span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="hidden py-2 lg:table-cell">
        {lead.ownerName ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-2xs font-medium text-primary-soft-foreground"
              aria-hidden="true"
            >
              {getInitials(lead.ownerName)}
            </span>
            {lead.ownerName}
          </span>
        ) : (
          <span className="text-muted-foreground">Sem responsável</span>
        )}
      </TableCell>
      <TableCell className="hidden py-2 sm:table-cell">
        {relative ? (
          <span
            className={cn('tabular-nums', IDLE_TONE_CLASS[getIdleTone(lead.lastActivityAt)])}
            title={formatDateTime(lead.lastActivityAt) ?? undefined}
          >
            {relative}
          </span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="py-2 text-right font-medium tabular-nums">
        {value ?? <span className="font-normal text-subtle-foreground">—</span>}
      </TableCell>
      <TableCell className="w-12 py-2 pr-3 text-right">
        {lead.contactId ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={buildInboxHref(lead.contactId)}
                aria-label={`Abrir conversa com ${lead.name}`}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-whatsapp-soft hover:text-whatsapp-soft-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Abrir conversa</TooltipContent>
          </Tooltip>
        ) : null}
      </TableCell>
    </TableRow>
  );
});

LeadTableRow.displayName = 'LeadTableRow';

export default LeadTableRow;
