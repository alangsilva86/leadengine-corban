import {
  BadgeCheck,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileText,
  ScrollText,
  Sparkles,
  StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { getStageInfo } from './utils/stage.js';

const TYPE_PRESENTATION = {
  note: { icon: StickyNote, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
  event: { icon: Sparkles, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
  simulation: { icon: ClipboardList, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
  proposal: { icon: FileText, toneClass: 'text-[color:var(--accent-inbox-primary)]' },
  deal: { icon: CircleDollarSign, toneClass: 'text-success-strong' },
};

const STAGE_TONE_CLASSES = {
  info: 'border-[color:var(--accent-inbox-primary)] bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_14%,transparent)] text-[color:var(--accent-inbox-primary)]',
  warning: 'border-warning-soft-border bg-warning-soft text-warning-strong',
  success: 'border-success-soft-border bg-success-soft text-success-strong',
  neutral: 'border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
};

const formatJson = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return null;
  }
};

const SalesStageChip = ({ stageKey, stageLabel }) => {
  if (!stageKey && !stageLabel) {
    return null;
  }

  const stageInfo = stageKey ? getStageInfo(stageKey) : null;
  const resolvedLabel = stageLabel ?? stageInfo?.label;
  if (!resolvedLabel) {
    return null;
  }

  const StageIcon = stageInfo?.icon ?? BadgeCheck;
  const tone = stageInfo?.tone ?? 'neutral';
  const toneClasses = STAGE_TONE_CLASSES[tone] ?? STAGE_TONE_CLASSES.neutral;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.18em]',
        toneClasses,
      )}
      data-stage-key={stageKey ?? undefined}
    >
      <StageIcon className="h-3.5 w-3.5" aria-hidden />
      {resolvedLabel}
    </span>
  );
};

const JsonSection = ({ title, value }) => {
  const formatted = formatJson(value);
  if (!formatted) {
    return null;
  }

  return (
    <details className="group rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet/60 px-3 py-2 text-[11px] text-foreground">
      <summary className="cursor-pointer list-none font-semibold text-foreground">
        <span className="inline-flex items-center gap-1">
          <ScrollText className="h-3.5 w-3.5 text-[color:var(--accent-inbox-primary)]" aria-hidden />
          {title}
        </span>
      </summary>
      <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-surface-overlay-quiet px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground-muted">
        {formatted}
      </pre>
    </details>
  );
};

export const EventCard = ({ entry }) => {
  if (!entry) return null;
  const presentation = TYPE_PRESENTATION[entry.type] ?? { icon: Clock, toneClass: 'text-[color:var(--accent-inbox-primary)]' };
  const Icon = presentation.icon ?? Clock;
  const toneClass = presentation.toneClass ?? 'text-[color:var(--accent-inbox-primary)]';
  const payload = entry.payload ?? {};
  const label = payload.label ?? entry.label ?? 'Atualização';
  const description = payload.description ?? payload.body ?? payload.metadata?.description ?? null;
  const timestamp = entry.date ? new Date(entry.date) : null;
  const stageChip = entry.type === 'simulation' || entry.type === 'proposal' || entry.type === 'deal'
    ? (
        <SalesStageChip stageKey={payload.stageKey ?? null} stageLabel={payload.stageLabel ?? null} />
      )
    : null;

  return (
    <div
      className={cn(
        'flex max-w-[70%] flex-col gap-2 rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] px-3 py-2 text-xs text-[color:var(--color-inbox-foreground-muted)] shadow-[0_12px_32px_-24px_rgba(15,23,42,0.9)]'
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-[color:var(--color-inbox-foreground)]">
        <Icon className={cn('h-4 w-4', toneClass)} aria-hidden />
        <span className="font-semibold">{label}</span>
        {stageChip}
      </div>
      {description ? <p className="text-xs text-[color:var(--color-inbox-foreground)]">{description}</p> : null}
      {timestamp ? (
        <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-inbox-foreground-muted)]">
          {timestamp.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
        </span>
      ) : null}
      {entry.type === 'simulation' || entry.type === 'proposal' || entry.type === 'deal' ? (
        <div className="flex flex-col gap-2">
          <JsonSection title="Snapshot de cálculo" value={payload.calculationSnapshot} />
          <JsonSection title="Metadata" value={payload.metadata} />
        </div>
      ) : null}
    </div>
  );
};

export default EventCard;
