import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Draggable } from '@hello-pangea/dnd';
import { ArrowRightLeft, Clock3, MessageCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import type { LeadSummary } from '../../state/leads';
import {
  IDLE_TONE_CLASS,
  buildInboxHref,
  formatDateTime,
  getIdleTone,
  getSourceIcon,
  getSourceLabel,
} from '../../utils/labels';
import type { LeadStage } from '../../utils/lead-stage';
import LeadStageMenu from '../lead-stage/LeadStageMenu';
import { formatBRL } from '@/lib/currency';
import { formatRelativeShort } from '@/lib/relative-time';
import { getInitials } from '@/lib/initials';

type LeadCardProps = {
  lead: LeadSummary;
  index: number;
  dragDisabled?: boolean | undefined;
  /** Versão enxuta para as saídas (Ganho, Perdido, Reciclar). */
  compact?: boolean | undefined;
  /** Chave da lista no Kanban (o mesmo lead não aparece duas vezes). */
  draggableId?: string | undefined;
  onOpen: (lead: LeadSummary) => void;
  /** Alternativa acessível ao arraste: menu "Mover para…". */
  onRequestMove?: ((lead: LeadSummary, stage: LeadStage) => void) | undefined;
};

const iconButtonClass =
  'pointer-events-auto relative inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Cartão do lead no funil (~96px):
 * 1) nome + valor · 2) origem · 3) responsável · tempo parado · mover · conversa.
 * O cartão inteiro abre o lead e é a alça de arraste (botão sobreposto); os atalhos ficam acima dele.
 */
const LeadCard = memo(
  ({ lead, index, dragDisabled = true, compact = false, draggableId, onOpen, onRequestMove }: LeadCardProps) => {
    const value = formatBRL(lead.potentialValue);
    const sourceLabel = getSourceLabel(lead.source);
    const SourceIcon = getSourceIcon(lead.source);
    const relative = formatRelativeShort(lead.lastActivityAt);
    const idleTone = compact ? 'default' : getIdleTone(lead.lastActivityAt);
    const ownerFirstName = lead.ownerName?.trim().split(/\s+/)[0] ?? null;

    const moveMenu = onRequestMove ? (
      <LeadStageMenu stage={lead.stage} onSelect={(stage) => onRequestMove(lead, stage)} label={`Mover ${lead.name} para`}>
        <button
          type="button"
          aria-label={`Mover ${lead.name} para outra etapa`}
          title="Mover para…"
          className={cn(
            iconButtonClass,
            'hover:bg-surface-hover hover:text-foreground data-[state=open]:bg-surface-hover',
            // Aparece no hover/foco do cartão (sempre visível em telas de toque).
            'opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100'
          )}
        >
          <ArrowRightLeft className="size-3.5" aria-hidden="true" />
        </button>
      </LeadStageMenu>
    ) : null;

    const chatLink = lead.contactId ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={buildInboxHref(lead.contactId)}
            className={cn(iconButtonClass, 'hover:bg-whatsapp-soft hover:text-whatsapp-soft-foreground')}
            aria-label={`Abrir conversa com ${lead.name}`}
          >
            <MessageCircle className="size-3.5" aria-hidden="true" />
          </Link>
        </TooltipTrigger>
        <TooltipContent>Abrir conversa</TooltipContent>
      </Tooltip>
    ) : null;

    return (
      <Draggable
        draggableId={draggableId ?? lead.id}
        index={index}
        isDragDisabled={dragDisabled}
        // A alça é um <button> (abre o lead com Enter/clique); sem isto o arraste não começaria nele.
        disableInteractiveElementBlocking
      >
        {(provided, snapshot) => (
          <li
            ref={provided.innerRef}
            {...provided.draggableProps}
            data-lead-card
            data-lead-stage={lead.stage}
            className={cn(
              'group relative list-none rounded-md border border-border bg-surface shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm',
              'focus-within:border-primary',
              compact ? 'px-3 py-2' : 'p-3',
              snapshot.isDragging && 'border-primary shadow-md ring-1 ring-primary/30'
            )}
          >
            <button
              type="button"
              data-open-lead
              {...provided.dragHandleProps}
              onClick={() => onOpen(lead)}
              aria-label={`Abrir lead ${lead.name}`}
              className={cn(
                'absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                dragDisabled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
              )}
            />

            {compact ? (
              <div className="pointer-events-none relative flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{lead.name}</p>
                {value ? <span className="shrink-0 text-xs font-medium text-foreground tabular-nums">{value}</span> : null}
                {relative ? (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums" title={formatDateTime(lead.lastActivityAt) ?? undefined}>
                    {relative}
                  </span>
                ) : null}
                {moveMenu}
              </div>
            ) : (
              <div className="pointer-events-none relative flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-medium leading-5 text-foreground">{lead.name}</p>
                  {value ? <span className="shrink-0 text-sm font-semibold leading-5 text-foreground tabular-nums">{value}</span> : null}
                </div>

                {sourceLabel ? (
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-muted-foreground">
                    <SourceIcon className="size-3" aria-hidden="true" />
                    {sourceLabel}
                  </span>
                ) : null}

                <div className="flex items-center gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full text-2xs font-medium',
                        ownerFirstName
                          ? 'bg-primary-soft text-primary-soft-foreground'
                          : 'border border-dashed border-border-strong text-subtle-foreground'
                      )}
                      aria-hidden="true"
                    >
                      {ownerFirstName ? getInitials(lead.ownerName) : '?'}
                    </span>
                    <span className="truncate">{ownerFirstName ?? 'Sem responsável'}</span>
                  </span>
                  {relative ? (
                    <span
                      className={cn('inline-flex shrink-0 items-center gap-1 tabular-nums', IDLE_TONE_CLASS[idleTone])}
                      title={`Última atividade ${formatDateTime(lead.lastActivityAt) ?? ''}`}
                    >
                      <Clock3 className="size-3" aria-hidden="true" />
                      <span className="sr-only">Última atividade</span>
                      {relative}
                    </span>
                  ) : null}
                  <span className="ml-auto flex shrink-0 items-center gap-0.5">
                    {moveMenu}
                    {chatLink}
                  </span>
                </div>
              </div>
            )}
          </li>
        )}
      </Draggable>
    );
  }
);

LeadCard.displayName = 'LeadCard';

export default LeadCard;
