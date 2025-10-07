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
        'flex w-full flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-950/75 p-3 text-left transition hover:border-sky-500/40 hover:bg-slate-900',
        selected && 'border-sky-500/80 bg-slate-900'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-900/80 p-2 text-sky-300">
            <ChannelIcon className="h-4 w-4" />
          </span>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
              <span className="max-w-[180px] truncate" title={name}>
                {name}
              </span>
              <StatusBadge status={ticket.status} />
            </div>
            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground/70">
              <PipelineStepTag step={ticket.pipelineStep ?? ticket.metadata?.pipelineStep} />
              {ticket.timeline?.unreadInboundCount ? (
                <Badge variant="secondary" className="border border-emerald-500/60 bg-emerald-500/10 text-[11px] font-medium text-emerald-300">
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

      <div className="flex items-center gap-2 text-[13px] text-muted-foreground/80">
        <SlaBadge window={ticket.window} />
        {ticket.qualityScore !== null && ticket.qualityScore !== undefined ? (
          <Badge variant="outline" className="border border-emerald-500/50 bg-emerald-500/10 text-[11px] font-medium text-emerald-300">
            Qualidade {ticket.qualityScore}%
          </Badge>
        ) : null}
        {ticket.lead?.probability ? (
          <Badge variant="outline" className="border border-sky-500/50 bg-sky-500/10 text-[11px] font-medium text-sky-200">
            {ticket.lead.probability}% chance
          </Badge>
        ) : null}
      </div>

      <div className="text-[13px] text-muted-foreground/80">
        {typingLabel ? <span className="font-medium text-emerald-300">{typingLabel}</span> : formatPreview(ticket)}
      </div>

      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground/70">
        <div className="flex items-center gap-1.5 text-[13px] font-normal text-muted-foreground/80">
          <Avatar className="h-6 w-6 border border-slate-800/70">
            <AvatarImage src={ticket.contact?.avatar} alt={name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {ticket.userId ? <span className="text-[13px] text-muted-foreground/80">Atribuído</span> : <span className="text-[13px] text-muted-foreground/80">Não atribuído</span>}
        </div>
        {phoneLabel ? <span className="text-[11px] font-medium text-muted-foreground/70">{phoneLabel}</span> : null}
        {ticket.timeline?.lastInboundAt ? (
          <span className="text-[11px] font-medium text-muted-foreground/70">
            Último cliente: {new Date(ticket.timeline.lastInboundAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : null}
      </div>
    </button>
  );
};

export default InboxItem;
