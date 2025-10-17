import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn, buildInitials, formatPhoneNumber } from '@/lib/utils.js';
import { MessageCircle, Mail, PhoneCall, Bot } from 'lucide-react';
import StatusBadge from '../Shared/StatusBadge.jsx';
import PipelineStepTag from '../Shared/PipelineStepTag.jsx';
import SlaBadge from './SlaBadge.jsx';
import AssignmentMenu from './AssignmentMenu.jsx';

const CHANNEL_ICONS = {
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  SMS: PhoneCall,
  VOICE: PhoneCall,
  CHAT: Bot,
};

const formatPreview = (ticket) => {
  if (ticket?.lastMessagePreview) return ticket.lastMessagePreview;
  if (ticket?.timeline?.lastDirection === 'INBOUND') {
    return 'Aguardando resposta';
  }
  if (ticket?.timeline?.lastDirection === 'OUTBOUND') {
    return 'Aguardando cliente';
  }
  return 'Sem mensagens ainda';
};

const getTypingLabel = (typingAgents) => {
  if (!typingAgents?.length) return null;
  const [firstAgent] = typingAgents;
  return `${firstAgent?.userName ?? 'Agente'} digitando…`;
};

const getPhoneLabel = (ticket) => {
  const phone = ticket?.contact?.phone;
  return phone ? formatPhoneNumber(phone) : null;
};

const getAssignmentLabel = (ticket) => (ticket?.userId ? 'Atribuído' : 'Não atribuído');

const getLastInboundLabel = (ticket, locale = 'pt-BR') => {
  const lastInbound = ticket?.timeline?.lastInboundAt;
  if (!lastInbound) return null;

  const date = new Date(lastInbound);
  if (Number.isNaN(date.getTime())) return null;

  const formattedTime = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Último cliente: ${formattedTime}`;
};

const createMenuHandler = (ticket, callback) => (event) => {
  event?.stopPropagation?.();
  callback?.(ticket);
};

export const InboxItem = ({
  ticket,
  selected,
  onSelect,
  typingAgents = [],
  onAssign,
  onTransfer,
  onMute,
  onFollowUp,
  onMacro,
}) => {
  if (!ticket) return null;

  const ChannelIcon = CHANNEL_ICONS[ticket.channel] ?? MessageCircle;
  const name = ticket.contact?.name ?? ticket.subject ?? 'Contato sem nome';
  const initials = buildInitials(name);
  const typingLabel = getTypingLabel(typingAgents);
  const preview = formatPreview(ticket);
  const phoneLabel = getPhoneLabel(ticket);
  const assignmentLabel = getAssignmentLabel(ticket);
  const lastInboundLabel = getLastInboundLabel(ticket);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(ticket.id)}
      className={cn(
        'flex w-full flex-col gap-4 rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet p-4 text-left text-foreground transition hover:border-primary/40 hover:bg-surface-overlay-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--ring)_75%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:color-mix(in_srgb,var(--bg)_92%,transparent)]',
        selected && 'border-primary/60 bg-surface-overlay-strong'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ChannelIcon className="h-4 w-4" />
          </span>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="max-w-[160px] truncate" title={name}>
                {name}
              </span>
              <StatusBadge status={ticket.status} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
              <PipelineStepTag step={ticket.pipelineStep ?? ticket.metadata?.pipelineStep} />
              {ticket.timeline?.unreadInboundCount ? (
                <Badge
                  variant="outline"
                  className="border border-primary/40 bg-primary/10 text-primary"
                >
                  {ticket.timeline.unreadInboundCount} novas
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <AssignmentMenu
          onAssign={createMenuHandler(ticket, onAssign)}
          onTransfer={createMenuHandler(ticket, onTransfer)}
          onMute={createMenuHandler(ticket, onMute)}
          onFollowUp={createMenuHandler(ticket, onFollowUp)}
          onMacro={createMenuHandler(ticket, onMacro)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
        <SlaBadge window={ticket.window} />
        {ticket.qualityScore !== null && ticket.qualityScore !== undefined ? (
          <Badge
            variant="outline"
            className="border border-success-soft-border bg-success-soft text-success-strong"
          >
            Qualidade {ticket.qualityScore}%
          </Badge>
        ) : null}
        {ticket.lead?.probability ? (
          <Badge
            variant="outline"
            className="border border-warning-soft-border bg-warning-soft text-warning-strong"
          >
            {ticket.lead.probability}% chance
          </Badge>
        ) : null}
      </div>

      <div className="text-sm text-foreground-muted">
        {typingLabel ? <span className="text-foreground">{typingLabel}</span> : preview}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-foreground-muted">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 border border-surface-overlay-glass-border">
            <AvatarImage src={ticket.contact?.avatar} alt={name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="text-[13px] text-foreground-muted">{assignmentLabel}</span>
        </div>
        {phoneLabel ? <span className="text-xs text-foreground-muted">{phoneLabel}</span> : null}
        {lastInboundLabel ? <span className="text-xs text-foreground-muted">{lastInboundLabel}</span> : null}
      </div>
    </button>
  );
};

export default InboxItem;
