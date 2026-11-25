import { FileText, Lock, Plus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const ICONS = { reply: Zap, templates: FileText, note: Lock, create: Plus };

/**
 * Paleta aberta ao digitar "/" no início da mensagem:
 * respostas rápidas (filtradas pelo que vem depois da barra) e atalhos.
 */
const SlashPalette = ({ id, items = [], activeIndex = 0, onSelect, onHover }) => {
  if (items.length === 0) {
    return (
      <div id={id} className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
        Nenhuma resposta rápida encontrada.
      </div>
    );
  }
  return (
    <ul id={id} role="listbox" aria-label="Respostas rápidas" className="max-h-60 overflow-y-auto border-b border-border p-1">
      {items.map((item, index) => {
        const Icon = ICONS[item.type] ?? Zap;
        const active = index === activeIndex;
        return (
          <li
            key={item.id}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={active}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect?.(item);
            }}
            onMouseEnter={() => onHover?.(index)}
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-sm',
              active ? 'bg-surface-hover text-foreground' : 'text-foreground',
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{item.label}</span>
              {item.preview ? <span className="block truncate text-xs text-muted-foreground">{item.preview}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default SlashPalette;
