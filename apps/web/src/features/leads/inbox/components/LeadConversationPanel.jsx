import { useMemo } from 'react';
import {
  CalendarClock,
  MessageCircle,
  MessageSquareDashed,
  PhoneCall,
  UserCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { cn } from '@/lib/utils.js';
import {
  ensureDate,
  formatDateTime,
  getFirstString,
  getFirstValidDate,
} from '../utils/index.js';
import { STATUS_META } from '../constants/statusMeta.js';
import { InboxPrimaryButton } from './shared/InboxPrimaryButton.jsx';
import { InboxSurface } from './shared/InboxSurface.jsx';

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

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
  const statusMeta = STATUS_META[status] ?? STATUS_META.allocated;
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
    <InboxSurface
      tone="bold"
      radius="xl"
      className="flex min-h-[520px] flex-col ring-1 ring-[color:var(--color-inbox-border)] backdrop-blur-xl xl:h-full xl:min-h-0"
    >
      <InboxSurface
        tone="quiet"
        radius="none"
        shadow="lg"
        border={false}
        className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--color-inbox-border)] px-6 py-4"
      >
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--color-inbox-foreground-muted)]">Timeline</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-[color:var(--color-inbox-foreground)]">
              {allocation ? allocation.fullName : 'Selecione um lead'}
            </h2>
            {allocation ? (
              <Badge
                variant="status"
                tone={statusMeta.tone}
                className="px-3 py-1 text-xs font-medium uppercase tracking-[0.26em]"
              >
                {statusMeta.label}
              </Badge>
            ) : null}
          </div>
          {lastMessagePreview ? (
            <p className="max-w-xl text-sm text-[color:var(--color-inbox-foreground-muted)] line-clamp-2">{lastMessagePreview}</p>
          ) : null}
        </div>
        <InboxPrimaryButton
          size="sm"
          className="gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-[0_12px_26px_color-mix(in_srgb,var(--accent-inbox-primary)_42%,transparent)]"
          onClick={() => (allocation && onOpenWhatsApp ? onOpenWhatsApp(allocation) : null)}
          disabled={!allocation?.phone || !onOpenWhatsApp}
        >
          <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
        </InboxPrimaryButton>
      </InboxSurface>

      <ScrollArea
        className="flex-1 min-h-0"
        viewportClassName={cn(
          'h-full px-6 py-6 overscroll-contain transition-opacity duration-150 ease-out',
          isSwitching ? 'opacity-0' : 'opacity-100'
        )}
        viewportProps={{
          style: { WebkitOverflowScrolling: 'touch', contain: 'content' },
        }}
      >
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
                <div className="h-4 w-full animate-pulse rounded-full bg-[color:var(--surface-overlay-quiet)]" />
              </div>
            ))}
          </div>
        ) : !allocation ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground/80">
            <MessageSquareDashed className="h-10 w-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground-muted">Selecione um lead para iniciar o foco</p>
              <p className="text-xs text-[color:var(--color-inbox-foreground-muted)]">
                A conversa aparece aqui com histórico e contexto assim que você escolhe um lead na lista.
              </p>
            </div>
          </div>
        ) : timeline.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground/80">
            <CalendarClock className="h-10 w-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground-muted">Nenhum evento registrado ainda</p>
              <p className="text-xs text-[color:var(--color-inbox-foreground-muted)]">
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
                    <div className="flex size-9 items-center justify-center rounded-full border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] shadow-[0_10px_22px_color-mix(in_srgb,var(--color-inbox-border)_45%,transparent)]">
                      <Icon className="h-4 w-4 text-[color:var(--color-inbox-foreground-muted)]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[color:var(--color-inbox-foreground)]">{event.label}</p>
                      <p className="text-xs text-[color:var(--color-inbox-foreground-muted)]">{formatDateTime(event.date)}</p>
                    </div>
                  </div>
                  {event.description ? (
                    <p className="ml-12 text-sm text-[color:var(--color-inbox-foreground-muted)]">{event.description}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </ScrollArea>
    </InboxSurface>
  );
};

export default LeadConversationPanel;
