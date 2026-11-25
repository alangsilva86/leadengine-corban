import { memo, useMemo } from 'react';
import { CheckCheck, User } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import { getTicketIdentity } from '../../utils/ticketIdentity.js';
import { useDraftPreview } from '../../hooks/useComposerDraft.js';
import InstanceBadge from '../Shared/InstanceBadge.jsx';
import { getTicketLeadStagePresentation } from '../../utils/leadStage.js';
import {
  formatListTimestamp,
  isWhatsAppTicket,
  resolveLastActivityAt,
  resolveTicketAssignee,
  resolveTicketInstanceId,
  resolveTicketPreview,
  resolveWaitingState,
} from '../ConversationArea/utils/presentation.js';
import { getPersonInitials } from '@/lib/initials';

const ContactAvatar = ({ name, whatsapp }) => (
  <span className="relative inline-flex size-9 shrink-0">
    <span
      aria-hidden
      className="inline-flex size-9 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold text-muted-foreground"
    >
      {getPersonInitials(name, '') || <User className="size-4" />}
    </span>
    {whatsapp ? (
      <span
        aria-hidden
        className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-whatsapp"
      />
    ) : null}
  </span>
);

const AssigneeAvatar = ({ assignee }) => {
  if (!assignee) return null;
  const label = assignee.isCurrentUser ? 'Você' : assignee.name ?? 'Atribuída';
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
            assignee.isCurrentUser ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-surface-sunken text-muted-foreground',
          )}
          aria-label={`Responsável: ${label}`}
          role="img"
        >
          {getPersonInitials(assignee.name, '') || <User className="size-3" />}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">Responsável: {label}</TooltipContent>
    </Tooltip>
  );
};

/**
 * Item da lista de conversas (~72px):
 * 1. avatar (ponto do WhatsApp) · nome (negrito se não lida) · horário
 * 2. ✓✓ se a última foi enviada · prévia ou "Rascunho: …" · contador de não lidas
 * 3. número · etapa do lead (ponto no tom da etapa) · "Aguardando há 2 h" · responsável
 * O checkbox de seleção é irmão do botão (nunca aninhado) e aparece no hover/foco
 * ou quando já existe seleção.
 */
/** Prévia substituída enquanto outro atendente escreve nesta conversa (nome do colega, nunca do cliente). */
const formatTeammateTyping = (agent) => {
  const name = typeof agent?.userName === 'string' && agent.userName.trim() ? agent.userName.trim().split(/\s+/)[0] : 'Alguém da equipe';
  return agent?.mode === 'note' ? `${name} escrevendo nota…` : `${name} digitando…`;
};

const QueueListItem = ({
  ticket,
  selected = false,
  selectedForBulk = false,
  selectionMode = false,
  typingAgent = null,
  currentUser = null,
  now,
  onSelect,
  onToggleSelection,
  onKeyDown,
}) => {
  const { displayName } = useMemo(() => getTicketIdentity(ticket), [ticket]);
  const draft = useDraftPreview(ticket?.id);
  const unread = ticket?.timeline?.unreadInboundCount ?? 0;
  const isUnread = unread > 0;
  const lastOutbound = ticket?.timeline?.lastDirection === 'OUTBOUND';
  const time = formatListTimestamp(resolveLastActivityAt(ticket));
  const instanceId = resolveTicketInstanceId(ticket);
  const stageInfo = getTicketLeadStagePresentation(ticket);
  const waiting = resolveWaitingState(ticket, now);
  const assignee = resolveTicketAssignee(ticket, currentUser);
  const preview = resolveTicketPreview(ticket);
  const whatsapp = isWhatsAppTicket(ticket);
  // "/" sozinho (paleta de respostas rápidas) não conta como rascunho.
  const draftText = /^\/\S*$/.test(draft.trim()) ? '' : draft.trim();

  const accessibleSummary = [
    displayName,
    isUnread ? `${unread} ${unread === 1 ? 'mensagem não lida' : 'mensagens não lidas'}` : null,
    draftText ? `rascunho: ${draftText.slice(0, 80)}` : preview ? preview.slice(0, 80) : null,
    stageInfo ? `etapa ${stageInfo.label}` : null,
    waiting?.label ?? null,
    time ? `última atividade ${time}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <li className="group/item relative" data-ticket-id={ticket.id}>
      <div
        className={cn(
          'absolute left-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-surface transition-opacity',
          selectionMode || selectedForBulk
            ? 'opacity-100'
            : 'opacity-0 focus-within:opacity-100 group-hover/item:opacity-100',
        )}
      >
        <Checkbox
          checked={selectedForBulk}
          onCheckedChange={() => onToggleSelection?.(ticket.id)}
          aria-label={selectedForBulk ? `Remover ${displayName} da seleção` : `Selecionar ${displayName}`}
        />
      </div>
      <button
        type="button"
        data-queue-item
        data-active={selected ? 'true' : 'false'}
        aria-current={selected ? 'true' : undefined}
        aria-label={accessibleSummary}
        onClick={() => onSelect?.(ticket.id)}
        onKeyDown={onKeyDown}
        className={cn(
          'relative flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left outline-none transition-colors',
          'hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          selected && 'bg-primary-soft hover:bg-primary-soft',
          selectedForBulk && !selected && 'bg-surface-sunken',
        )}
      >
        {selected ? <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" /> : null}
        <ContactAvatar name={displayName} whatsapp={whatsapp} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5" aria-hidden>
          <span className="flex min-w-0 items-baseline gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm text-foreground',
                isUnread ? 'font-semibold' : 'font-medium',
              )}
            >
              {displayName}
            </span>
            {time ? (
              <span className={cn('shrink-0 text-xs', isUnread ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                {time}
              </span>
            ) : null}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            {typingAgent ? (
              <span className="min-w-0 flex-1 truncate text-sm italic text-primary" data-testid="queue-item-typing">
                {formatTeammateTyping(typingAgent)}
              </span>
            ) : draftText ? (
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                <span className="font-medium text-danger-soft-foreground">Rascunho:</span> {draftText}
              </span>
            ) : (
              <>
                {lastOutbound ? <CheckCheck className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden /> : null}
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm',
                    isUnread ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {preview}
                </span>
              </>
            )}
            {isUnread ? (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-2xs font-semibold text-primary-foreground">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </span>
          <span className={cn('flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground', assignee && 'pr-6')}>
            {instanceId ? (
              <InstanceBadge
                instanceId={instanceId}
                variant="plain"
                withTooltip={false}
                className="min-w-0 shrink-[4] text-xs font-normal"
              />
            ) : null}
            {stageInfo ? (
              <>
                {instanceId ? <span aria-hidden className="shrink-0 text-subtle-foreground">·</span> : null}
                <span className="inline-flex min-w-0 shrink-[2] items-center gap-1" data-stage={stageInfo.id}>
                  <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', stageInfo.classes.dot)} />
                  <span className="truncate">{stageInfo.label}</span>
                </span>
              </>
            ) : null}
            {waiting ? (
              <>
                {instanceId || stageInfo ? <span aria-hidden className="shrink-0 text-subtle-foreground">·</span> : null}
                <span
                  className={cn('min-w-0 shrink-0 truncate', waiting.overdue && 'font-medium text-warning-soft-foreground')}
                  title={waiting.label}
                >
                  {waiting.shortLabel ?? waiting.label}
                </span>
              </>
            ) : null}
          </span>
        </span>
      </button>
      {assignee ? (
        <span className="pointer-events-auto absolute bottom-3 right-3">
          <AssigneeAvatar assignee={assignee} />
        </span>
      ) : null}
    </li>
  );
};

export default memo(QueueListItem);
