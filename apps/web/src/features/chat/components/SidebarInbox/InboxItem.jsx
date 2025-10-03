import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';
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

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
  const typingLabel = typingAgents.length > 0 ? `${typingAgents[0].userName ?? 'Agente'} digitando…` : null;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(ticket.id)}
      className={cn(
        'flex w-full flex-col gap-2 rounded-xl border border-slate-800/70 bg-slate-950/75 p-3 text-left transition hover:border-slate-600/70 hover:bg-slate-900',
        selected && 'border-sky-500/60 bg-slate-900'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-800/80 p-2 text-sky-300">
            <ChannelIcon className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <span className="truncate max-w-[160px]" title={name}>
                {name}
              </span>
              <StatusBadge status={ticket.status} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <PipelineStepTag step={ticket.pipelineStep ?? ticket.metadata?.pipelineStep} />
              {ticket.timeline?.unreadInboundCount ? (
                <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-200">
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

      <div className="flex items-center gap-2 text-xs text-slate-300">
        <SlaBadge window={ticket.window} />
        {ticket.qualityScore !== null && ticket.qualityScore !== undefined ? (
          <Badge variant="outline" className="border border-emerald-500/50 bg-emerald-500/10 text-emerald-200">
            Qualidade {ticket.qualityScore}%
          </Badge>
        ) : null}
        {ticket.lead?.probability ? (
          <Badge variant="outline" className="border border-sky-500/50 bg-sky-500/10 text-sky-200">
            {ticket.lead.probability}% chance
          </Badge>
        ) : null}
      </div>

      <div className="text-xs text-slate-400">
        {typingLabel ? <span className="text-emerald-200">{typingLabel}</span> : formatPreview(ticket)}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <Avatar className="h-6 w-6 border border-slate-700/70">
            <AvatarImage src={ticket.contact?.avatar} alt={name} />
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
          {ticket.userId ? <span>Atribuído</span> : <span>Não atribuído</span>}
        </div>
        {ticket.timeline?.lastInboundAt ? (
          <span>
            Último cliente: {new Date(ticket.timeline.lastInboundAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : null}
      </div>
    </button>
  );
};

export default InboxItem;
