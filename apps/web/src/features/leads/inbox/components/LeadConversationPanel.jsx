import { useMemo } from 'react';
import {
  CalendarClock,
  MessageCircle,
  MessageSquareDashed,
  PhoneCall,
  UserCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';

const STATUS_LABEL = {
  allocated: 'Aguardando contato',
  contacted: 'Em conversa',
  won: 'Venda realizada',
  lost: 'Sem interesse',
};

const STATUS_TONE = {
  allocated: 'border-white/10 bg-white/[0.05] text-muted-foreground/85',
  contacted: 'border-slate-500/35 bg-slate-500/12 text-slate-100/90',
  won: 'border-slate-200/40 bg-slate-200/10 text-slate-100',
  lost: 'border-rose-500/45 bg-rose-500/12 text-rose-100',
};

const ensureDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const date = ensureDate(value);
  if (!date) return null;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildTimeline = (allocation) => {
  if (!allocation) return [];

  const events = [
    {
      key: 'lastMessageAt',
      label: 'Última mensagem',
      icon: MessageCircle,
      timestamp: allocation.lastMessageAt ?? allocation.lastInteractionAt,
      description: allocation.lastMessageSnippet ?? allocation.lastMessage ?? null,
    },
    {
      key: 'allocatedAt',
      label: 'Lead atribuído',
      icon: UserCheck,
      timestamp: allocation.allocatedAt,
    },
    {
      key: 'firstMessageAt',
      label: 'Primeira mensagem',
      icon: PhoneCall,
      timestamp: allocation.firstMessageAt ?? allocation.createdAt,
    },
  ];

  return events
    .map((event) => ({
      ...event,
      date: ensureDate(event.timestamp),
    }))
    .filter((event) => event.date)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
};

const LeadConversationPanel = ({ allocation, onOpenWhatsApp, isLoading, isSwitching }) => {
  const timeline = useMemo(() => buildTimeline(allocation), [allocation]);
  const status = allocation?.status ?? 'allocated';
  const statusLabel = STATUS_LABEL[status] ?? 'Em acompanhamento';
  const statusTone = STATUS_TONE[status] ?? STATUS_TONE.allocated;
  const lastMessagePreview = allocation?.lastMessageSnippet ?? allocation?.lastMessage ?? null;

  return (
    <div className="flex h-full min-h-[520px] flex-col rounded-3xl border border-white/5 bg-slate-950/70 shadow-[0_8px_32px_rgba(15,23,42,0.32)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground/70">Timeline</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {allocation ? allocation.fullName : 'Selecione um lead'}
            </h2>
            {allocation ? (
              <Badge
                variant="outline"
                className={cn(
                  'border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.26em] transition-colors',
                  statusTone
                )}
              >
                {statusLabel}
              </Badge>
            ) : null}
          </div>
          {lastMessagePreview ? (
            <p className="max-w-xl text-sm text-muted-foreground/90 line-clamp-2">{lastMessagePreview}</p>
          ) : null}
        </div>
        <Button
          size="sm"
          className="gap-2 rounded-full bg-emerald-500/90 px-4 py-2 text-sm font-medium text-emerald-950 shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
          onClick={() => (allocation && onOpenWhatsApp ? onOpenWhatsApp(allocation) : null)}
          disabled={!allocation?.phone || !onOpenWhatsApp}
        >
          <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
        </Button>
      </div>

      <div
        className={cn(
          'flex-1 overflow-y-auto px-6 py-6 transition-opacity duration-200 ease-out',
          isSwitching ? 'opacity-0' : 'opacity-100'
        )}
      >
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
                <div className="h-4 w-full animate-pulse rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        ) : !allocation ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground/80">
            <MessageSquareDashed className="h-10 w-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/80">Selecione um lead para iniciar o foco</p>
              <p className="text-xs text-muted-foreground/70">
                A conversa aparece aqui com histórico e contexto assim que você escolhe um lead na lista.
              </p>
            </div>
          </div>
        ) : timeline.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground/80">
            <CalendarClock className="h-10 w-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/80">Nenhum evento registrado ainda</p>
              <p className="text-xs text-muted-foreground/70">
                Assim que o lead interagir pelo WhatsApp, registramos automaticamente os marcos aqui.
              </p>
            </div>
          </div>
        ) : (
          <ol className="space-y-6">
            {timeline.map((event) => {
              const Icon = event.icon ?? CalendarClock;
              return (
                <li key={`${event.key}-${event.date?.getTime?.() ?? Math.random()}`} className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
                      <Icon className="h-4 w-4 text-muted-foreground/70" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground/90">{event.label}</p>
                      <p className="text-xs text-muted-foreground/70">{formatDateTime(event.date)}</p>
                    </div>
                  </div>
                  {event.description ? (
                    <p className="ml-12 text-sm text-muted-foreground/90">{event.description}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};

export default LeadConversationPanel;
