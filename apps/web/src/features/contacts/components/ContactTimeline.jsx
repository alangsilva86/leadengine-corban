import { Globe, History, Mail, MessageCircle, MoreHorizontal, Phone } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/page';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { formatDateTime } from '@/features/crm/utils/labels';
import { formatRelativeShort } from '@/lib/relative-time';

export const INTERACTION_CHANNELS = [
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle },
  { value: 'PHONE', label: 'Ligação', icon: Phone },
  { value: 'EMAIL', label: 'E-mail', icon: Mail },
  { value: 'WEB', label: 'Site', icon: Globe },
  { value: 'OTHER', label: 'Outro', icon: MoreHorizontal },
];

const CHANNEL_BY_VALUE = new Map(INTERACTION_CHANNELS.map((entry) => [entry.value, entry]));

const DIRECTION_LABELS = { INBOUND: 'Recebida', OUTBOUND: 'Enviada' };

/** Histórico de interações do contato (GET /api/contacts/:id/interactions). */
const ContactTimeline = ({ items = [], isLoading = false, error = null, onRetry }) => {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState size="compact" title="Não foi possível carregar o histórico" error={error} onRetry={onRetry} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={History}
        title="Nenhuma interação registrada"
        description="Registre ligações e atendimentos fora do WhatsApp para manter o histórico completo."
      />
    );
  }

  return (
    <ol className="relative space-y-4 before:absolute before:inset-y-2 before:left-4 before:w-px before:bg-border">
      {items.map((item) => {
        const channel = CHANNEL_BY_VALUE.get(item.channel) ?? CHANNEL_BY_VALUE.get('OTHER');
        const Icon = channel.icon;
        const when = item.occurredAt ?? item.createdAt;
        return (
          <li key={item.id} className="relative flex gap-3">
            <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{channel.label}</span>
                {DIRECTION_LABELS[item.direction] ? ` · ${DIRECTION_LABELS[item.direction]}` : ''}
                {when ? (
                  <>
                    {' · '}
                    <time dateTime={new Date(when).toISOString()} title={formatDateTime(when) ?? undefined}>
                      {formatRelativeShort(when)}
                    </time>
                  </>
                ) : null}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">{item.summary || 'Interação sem resumo.'}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default ContactTimeline;
