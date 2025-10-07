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
  const phoneLabel = ticket.contact?.phone ? formatPhoneNumber(ticket.contact.phone) : null;
  const typingLabel = typingAgents.length > 0 ? `${typingAgents[0].userName ?? 'Agente'} digitando…` : null;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(ticket.id)}
      className={cn(
        'flex w-full flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-left text-slate-200 transition hover:border-slate-600 hover:bg-slate-900',
        selected && 'border-sky-500/60 bg-slate-900'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-slate-300">
            <ChannelIcon className="h-4 w-4" />
          </span>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <span className="max-w-[160px] truncate" title={name}>
                {name}
              </span>
              <StatusBadge status={ticket.status} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <PipelineStepTag step={ticket.pipelineStep ?? ticket.metadata?.pipelineStep} />
              {ticket.timeline?.unreadInboundCount ? (
                <Badge variant="outline" className="border border-slate-700 bg-transparent text-slate-300">
                  {ticket.timeline.unreadInboundCount} novas
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <AssignmentMenu
          onAssign={(event) => {
            event?.stopPropagation?.();
            onAssign?.(ticket);
          }}
          onTransfer={(event) => {
            event?.stopPropagation?.();
            onTransfer?.(ticket);
          }}
          onMute={(event) => {
            event?.stopPropagation?.();
            onMute?.(ticket);
          }}
          onFollowUp={(event) => {
            event?.stopPropagation?.();
            onFollowUp?.(ticket);
          }}
          onMacro={(event) => {
            event?.stopPropagation?.();
            onMacro?.(ticket);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <SlaBadge window={ticket.window} />
        {ticket.qualityScore !== null && ticket.qualityScore !== undefined ? (
          <Badge variant="outline" className="border border-slate-700 bg-transparent text-slate-300">
            Qualidade {ticket.qualityScore}%
          </Badge>
        ) : null}
        {ticket.lead?.probability ? (
          <Badge variant="outline" className="border border-slate-700 bg-transparent text-slate-300">
            {ticket.lead.probability}% chance
          </Badge>
        ) : null}
      </div>

      <div className="text-sm text-slate-300">
        {typingLabel ? <span className="text-slate-100">{typingLabel}</span> : formatPreview(ticket)}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 border border-slate-800/70">
            <AvatarImage src={ticket.contact?.avatar} alt={name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {ticket.userId ? <span>Atribuído</span> : <span>Não atribuído</span>}
        </div>
        {phoneLabel ? <span className="text-slate-500">{phoneLabel}</span> : null}
        {ticket.timeline?.lastInboundAt ? (
          <span>
            Último cliente: {new Date(ticket.timeline.lastInboundAt).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ) : null}
      </div>
    </button>
  );
};

export default InboxItem;
