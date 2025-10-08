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
  allocated: 'border-white/20 bg-white/[0.08] text-white/80',
  contacted: 'border-sky-400/40 bg-sky-500/20 text-sky-100',
  won: 'border-emerald-400/45 bg-emerald-400/20 text-emerald-100',
  lost: 'border-rose-500/50 bg-rose-500/18 text-rose-100',
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

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const getNestedValue = (object, path) => {
  if (!isPlainObject(object)) return undefined;
  return path.reduce((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return acc[key];
    }
    return undefined;
  }, object);
};

const getFirstValidDate = (object, paths) => {
  for (const path of paths) {
    const candidate = getNestedValue(object, path);
    const date = ensureDate(candidate);
    if (date) {
      return { value: candidate, date, path };
    }
  }
  return null;
};

const getFirstString = (object, paths) => {
  for (const path of paths) {
    const candidate = getNestedValue(object, path);
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
};

const buildTimeline = (allocation) => {
  if (!allocation) return [];

  const events = [];
  const pushEvent = (event) => {
    const date = ensureDate(event.timestamp);
    if (!date) return;
    events.push({ ...event, date });
  };

  pushEvent({
    key: 'receivedAt',
    label: 'Lead recebido',
    icon: UserCheck,
    timestamp: allocation.receivedAt,
    description: allocation.notes ?? null,
  });

  pushEvent({
    key: 'updatedAt',
    label: 'Atualização do lead',
    icon: CalendarClock,
    timestamp: allocation.updatedAt,
  });

  const payload = isPlainObject(allocation.payload) ? allocation.payload : null;

  if (payload) {
    const creation = getFirstValidDate(payload, [
      ['createdAt'],
      ['metadata', 'createdAt'],
      ['details', 'createdAt'],
    ]);
    if (creation) {
      pushEvent({
        key: `payload-created-${creation.path.join('.')}`,
        label: 'Lead criado na origem',
        icon: CalendarClock,
        timestamp: creation.value,
      });
    }

    const firstInteraction = getFirstValidDate(payload, [
      ['firstInteractionAt'],
      ['firstMessageAt'],
      ['metadata', 'firstInteractionAt'],
      ['history', 'firstMessageAt'],
    ]);
    if (firstInteraction) {
      pushEvent({
        key: `payload-first-${firstInteraction.path.join('.')}`,
        label: 'Primeira interação registrada',
        icon: PhoneCall,
        timestamp: firstInteraction.value,
      });
    }

    const lastInteraction =
      getFirstValidDate(payload, [
        ['lastInteractionAt'],
        ['lastMessageAt'],
        ['lastInteraction', 'timestamp'],
        ['lastInteraction', 'createdAt'],
        ['lastMessage', 'timestamp'],
        ['lastMessage', 'createdAt'],
        ['metadata', 'lastInteractionAt'],
      ]) ?? null;

    if (lastInteraction) {
      const lastMessageText =
        getFirstString(payload, [
          ['lastMessagePreview'],
          ['lastMessageSnippet'],
          ['lastMessage', 'preview'],
          ['lastMessage', 'text'],
          ['lastMessage', 'body'],
          ['lastInteraction', 'message'],
          ['lastInteraction', 'text'],
          ['lastInteraction', 'body'],
        ]) ?? null;

      pushEvent({
        key: `payload-last-${lastInteraction.path.join('.')}`,
        label: 'Última interação',
        icon: MessageCircle,
        timestamp: lastInteraction.value,
        description: lastMessageText,
      });
    }
  }

  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
};

const LeadConversationPanel = ({ allocation, onOpenWhatsApp, isLoading, isSwitching }) => {
  const timeline = useMemo(() => buildTimeline(allocation), [allocation]);
  const status = allocation?.status ?? 'allocated';
  const statusLabel = STATUS_LABEL[status] ?? 'Em acompanhamento';
  const statusTone = STATUS_TONE[status] ?? STATUS_TONE.allocated;
  const payload = isPlainObject(allocation?.payload) ? allocation.payload : null;
  const lastMessagePreview =
    getFirstString(payload, [
      ['lastMessagePreview'],
      ['lastMessageSnippet'],
      ['lastMessage', 'preview'],
      ['lastMessage', 'text'],
      ['lastMessage', 'body'],
      ['lastInteraction', 'message'],
      ['lastInteraction', 'text'],
      ['lastInteraction', 'body'],
    ]) ?? allocation?.notes ?? null;

  return (
    <div className="flex h-full min-h-[520px] flex-col rounded-[32px] border border-surface-contrast bg-slate-950/50 shadow-[0_30px_64px_-42px_rgba(15,23,42,0.9)] ring-1 ring-white/10 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/12 bg-white/[0.05] px-6 py-4 shadow-[0_20px_38px_-28px_rgba(15,23,42,0.9)]">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/70">Timeline</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-white/95">
              {allocation ? allocation.fullName : 'Selecione um lead'}
            </h2>
            {allocation ? (
              <Badge
                variant="outline"
                className={cn(
                  'border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.26em] text-white/80 transition-colors',
                  statusTone
                )}
              >
                {statusLabel}
              </Badge>
            ) : null}
          </div>
          {lastMessagePreview ? (
            <p className="max-w-xl text-sm text-white/80 line-clamp-2">{lastMessagePreview}</p>
          ) : null}
        </div>
        <Button
          size="sm"
          className="gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 shadow-[0_12px_26px_rgba(16,185,129,0.45)] transition hover:bg-emerald-400"
          onClick={() => (allocation && onOpenWhatsApp ? onOpenWhatsApp(allocation) : null)}
          disabled={!allocation?.phone || !onOpenWhatsApp}
        >
          <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
        </Button>
      </div>

      <div
        className={cn(
          'flex-1 overflow-y-auto px-6 py-6 transition-opacity duration-150 ease-out',
          isSwitching ? 'opacity-0' : 'opacity-100'
        )}
      >
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded-full bg-white/12" />
                <div className="h-4 w-full animate-pulse rounded-full bg-white/12" />
              </div>
            ))}
          </div>
        ) : !allocation ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground/80">
            <MessageSquareDashed className="h-10 w-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground-muted">Selecione um lead para iniciar o foco</p>
              <p className="text-xs text-white/70">
                A conversa aparece aqui com histórico e contexto assim que você escolhe um lead na lista.
              </p>
            </div>
          </div>
        ) : timeline.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground/80">
            <CalendarClock className="h-10 w-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground-muted">Nenhum evento registrado ainda</p>
              <p className="text-xs text-white/70">
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
                    <div className="flex size-9 items-center justify-center rounded-full border border-surface-contrast bg-white/[0.08] shadow-[0_10px_22px_rgba(4,10,26,0.35)]">
                      <Icon className="h-4 w-4 text-white/75" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/90">{event.label}</p>
                      <p className="text-xs text-white/70">{formatDateTime(event.date)}</p>
                    </div>
                  </div>
                  {event.description ? (
                    <p className="ml-12 text-sm text-white/80">{event.description}</p>
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
