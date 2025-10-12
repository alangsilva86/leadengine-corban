import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
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
  const tone = outbound
    ? 'bg-sky-500/15 text-slate-50 ring-1 ring-sky-500/40'
    : 'bg-slate-950/30 text-slate-100 ring-1 ring-white/5';
  const bubbleClass = cn(
    'max-w-[75%] rounded-[26px] px-4 py-3 text-sm leading-relaxed shadow-[0_20px_45px_-32px_rgba(15,23,42,0.9)] backdrop-blur',
    tone,
    outbound ? 'self-end rounded-tr-sm' : 'self-start rounded-tl-sm'
  );
  const metadata = (message.metadata && typeof message.metadata === 'object' ? message.metadata : {}) ?? {};
  const brokerMetadata = metadata?.broker && typeof metadata.broker === 'object' ? metadata.broker : {};
  const rawKeyMeta = metadata.rawKey && typeof metadata.rawKey === 'object' ? metadata.rawKey : {};
  const sourceInstance = metadata.sourceInstance ?? brokerMetadata.instanceId ?? message.instanceId ?? 'baileys';
  const remoteJid = metadata.remoteJid ?? metadata.chatId ?? rawKeyMeta.remoteJid ?? null;
  const phoneLabel = metadata.phoneE164 ?? remoteJid ?? message.chatId ?? 'desconhecido';
  const originChipTone = outbound
    ? 'bg-sky-500/15 text-sky-100 border border-sky-400/40'
    : 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/40';
  const directionChipTone = outbound
    ? 'bg-sky-500/40 text-sky-100'
    : 'bg-emerald-500/40 text-emerald-100';
  const directionLabel = outbound ? 'OUT' : 'IN';
  const timestamp = message.createdAt ? new Date(message.createdAt) : null;
  const tooltipTimestamp = timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toISOString() : null;

  const ack = STATUS_ICONS[message.status ?? 'SENT'] ?? STATUS_ICONS.SENT;

  return (
    <div className={cn('flex w-full flex-col gap-1', outbound ? 'items-end' : 'items-start')}>
      <div className={bubbleClass}>
        <div className={cn('mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide', outbound ? 'justify-end' : 'justify-start')}>
          <span className={cn('rounded-full px-2 py-0.5', directionChipTone)}>{directionLabel}</span>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span className={cn('rounded-full px-2 py-0.5 lowercase normal-case', originChipTone)}>
                {`via ${sourceInstance} • ${phoneLabel}`}
              </span>
            </TooltipTrigger>
            <TooltipContent className="space-y-1">
              <p className="font-semibold">Instância: {sourceInstance}</p>
              {remoteJid ? <p className="text-xs text-muted-foreground">remoteJid: {remoteJid}</p> : null}
              {tooltipTimestamp ? (
                <p className="text-xs text-muted-foreground">timestamp: {tooltipTimestamp}</p>
              ) : null}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content}
        </div>
        <AttachmentPreview attachments={message.attachments} />
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
          <span>{formatTime(message.createdAt)}</span>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  ack.tone
                )}
                aria-label={ack.label}
              >
                <ack.icon className="h-3 w-3" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{ack.label}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
