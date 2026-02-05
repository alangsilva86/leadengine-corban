import { Clock, FileText, Sparkles, StickyNote, ClipboardList, CircleDollarSign, ScrollText } from 'lucide-react';

import { cn } from '@/lib/utils.js';
import { formatJson } from '@/features/chat/utils/simulation.js';

const TYPE_PRESENTATION = {
  note: { icon: StickyNote, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
  event: { icon: Sparkles, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
  simulation: { icon: ClipboardList, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
  proposal: { icon: FileText, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
  deal: { icon: CircleDollarSign, toneClass: 'text-success-strong' },
};

export const EventCard = ({ entry }) => {
  if (!entry) return null;

  const presentation = TYPE_PRESENTATION[entry.type] ?? {
    icon: Clock,
    toneClass: 'text-[color:var(--accent-inbox-primary)]',
  };
  const Icon = presentation.icon ?? Clock;
  const toneClass = presentation.toneClass ?? 'text-[color:var(--accent-inbox-primary)]';

  const payload = entry.payload ?? {};
  const label = payload.label ?? entry.label ?? 'Atualização';
  const description = payload.description ?? payload.body ?? payload.metadata?.description ?? null;
  const timestamp = entry.date ? new Date(entry.date) : null;

  const snapshotJson = formatJson(payload.calculationSnapshot ?? payload.snapshot ?? null);
  const metadataJson = formatJson(payload.metadata ?? null);

  return (
    <div
      className={cn(
        'flex max-w-[70%] flex-col gap-2 rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] px-3 py-2 text-xs text-[color:var(--color-inbox-foreground-muted)] shadow-[0_12px_32px_-24px_rgba(15,23,42,0.9)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-[color:var(--color-inbox-foreground)]">
        <Icon className={cn('h-4 w-4', toneClass)} aria-hidden />
        <span className="font-semibold">{label}</span>
      </div>
      {description ? <p className="text-xs text-[color:var(--color-inbox-foreground)]">{description}</p> : null}
      {timestamp ? (
        <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-inbox-foreground-muted)]">
          {timestamp.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
        </span>
      ) : null}
      {snapshotJson || metadataJson ? (
        <details className="group rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)]/60 px-3 py-2">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-[color:var(--color-inbox-foreground)]">
            <span className="inline-flex items-center gap-1">
              <ScrollText className="h-3.5 w-3.5 text-[color:var(--accent-inbox-primary)]" aria-hidden />
              Ver detalhes avançados
            </span>
          </summary>
          {snapshotJson ? (
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">Snapshot</p>
              <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-[color:var(--surface-overlay-inbox-quiet)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[color:var(--color-inbox-foreground-muted)]">
                {snapshotJson}
              </pre>
            </div>
          ) : null}
          {metadataJson ? (
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">Metadata</p>
              <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-[color:var(--surface-overlay-inbox-quiet)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[color:var(--color-inbox-foreground-muted)]">
                {metadataJson}
              </pre>
            </div>
          ) : null}
        </details>
      ) : null}
    </div>
  );
};

export default EventCard;

