import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import { Check, CheckCheck, BadgeCheck, AlertTriangle } from 'lucide-react';
import AttachmentPreview from '../Shared/AttachmentPreview.jsx';

const STATUS_ICONS = {
  PENDING: { icon: Check, tone: 'text-slate-400', label: 'Pendente' },
  SENT: { icon: Check, tone: 'text-slate-400', label: 'Enviado' },
  DELIVERED: { icon: CheckCheck, tone: 'text-slate-300', label: 'Entregue' },
  READ: { icon: BadgeCheck, tone: 'text-emerald-400', label: 'Lido' },
  FAILED: { icon: AlertTriangle, tone: 'text-rose-400', label: 'Falha no envio' },
};

const formatTime = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const MessageBubble = ({ message }) => {
  const direction = message.direction ?? 'INBOUND';
  const outbound = direction === 'OUTBOUND';
  const tone = outbound ? 'bg-sky-600/30 border-sky-500/40 text-slate-50' : 'bg-slate-900/80 border-slate-800/80 text-slate-100';
  const bubbleClass = cn(
    'max-w-[75%] rounded-2xl border px-4 py-2 text-sm shadow-sm',
    tone,
    outbound ? 'self-end rounded-tr-sm' : 'self-start rounded-tl-sm'
  );

  const ack = STATUS_ICONS[message.status ?? 'SENT'] ?? STATUS_ICONS.SENT;

  return (
    <div className={cn('flex w-full flex-col gap-1', outbound ? 'items-end' : 'items-start')}>
      <div className={bubbleClass}>
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content}
        </div>
        <AttachmentPreview attachments={message.attachments} />
        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
          <span>{formatTime(message.createdAt)}</span>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('inline-flex items-center gap-1', ack.tone)}>
                  <ack.icon className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{ack.label}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
