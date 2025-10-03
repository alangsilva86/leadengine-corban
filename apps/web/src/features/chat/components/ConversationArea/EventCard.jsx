import { StickyNote, Sparkles, Clock } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const ICONS = {
  note: StickyNote,
  event: Sparkles,
};

export const EventCard = ({ entry }) => {
  if (!entry) return null;
  const Icon = ICONS[entry.type] ?? Clock;
  const label = entry.payload?.label ?? entry.label ?? 'Atualização';
  const description = entry.payload?.description ?? entry.payload?.body ?? entry.payload?.metadata?.description;
  const timestamp = entry.date ? new Date(entry.date) : null;

  return (
    <div className={cn('flex max-w-[70%] flex-col gap-1 rounded-xl border border-slate-800/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-300')}>
      <div className="flex items-center gap-2 text-slate-200">
        <Icon className="h-4 w-4 text-amber-300" />
        <span>{label}</span>
      </div>
      {description ? <p className="text-slate-400">{description}</p> : null}
      {timestamp ? (
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
          {timestamp.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
        </span>
      ) : null}
    </div>
  );
};

export default EventCard;
