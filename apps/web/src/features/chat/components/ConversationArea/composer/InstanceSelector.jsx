import { useState } from 'react';
import { Check, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { cn } from '@/lib/utils.js';
import { TONE_DOT_CLASSES, toSentenceCase } from '../utils/presentation.js';

const STATUS_LABELS = {
  connected: 'Conectado',
  connecting: 'Conectando',
  disconnected: 'Desconectado',
  qr_required: 'Precisa ler o QR Code',
  error: 'Com erro',
};

const statusLabelFor = (option) =>
  STATUS_LABELS[option?.status] ?? (option?.connected ? 'Conectado' : 'Desconectado');

/**
 * "Enviando por {número} ● Conectado" — e permite trocar o número de envio.
 */
const InstanceSelector = ({ selector, open: openProp, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  if (!selector) return null;

  const options = Array.isArray(selector.options) ? selector.options : [];
  const selected = options.find((option) => option.id === selector.selectedId) ?? null;
  const label = toSentenceCase(selector.selectedLabel ?? selected?.label ?? selector.defaultLabel ?? null);
  const connected = selector.selectedConnected !== false;
  const tone = selected ? (selected.connected ? 'success' : 'danger') : connected ? 'muted' : 'danger';

  if (!label && options.length === 0) {
    if (selector.loading && !selector.ready) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Carregando números…
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-danger" aria-hidden />
        Nenhum número de WhatsApp conectado ·{' '}
        <a href="/channels" className="font-medium text-primary underline-offset-2 hover:underline">
          Conectar
        </a>
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Número de envio: ${label ?? 'não selecionado'}, ${selected ? statusLabelFor(selected) : connected ? 'conectado' : 'desconectado'}. Trocar número`}
        >
          <span className="truncate">
            Enviando por <span className="font-medium text-foreground">{label ?? 'selecione um número'}</span>
          </span>
          <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT_CLASSES[tone] ?? TONE_DOT_CLASSES.muted)} aria-hidden />
          <span className={cn('shrink-0', !connected && 'font-medium text-danger-soft-foreground')}>
            {selected ? statusLabelFor(selected) : connected ? 'Conectado' : 'Desconectado'}
          </span>
          <ChevronDown className="size-3 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-semibold text-foreground">Enviar por qual número?</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => selector.onRefresh?.()}
            disabled={selector.loading}
            aria-label="Atualizar números"
            title="Atualizar números"
          >
            <RefreshCw className={cn(selector.loading && 'animate-spin')} aria-hidden />
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label="Números de WhatsApp">
          {options.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhum número conectado. Conecte um número em Canais.
            </p>
          ) : (
            options.map((option) => {
              const isSelected = option.id === selector.selectedId;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    selector.onSelect?.(option.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected && 'bg-primary-soft hover:bg-primary-soft',
                  )}
                >
                  <span
                    className={cn('mt-1.5 size-2 shrink-0 rounded-full', option.connected ? 'bg-success' : 'bg-danger')}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">{toSentenceCase(option.label)}</span>
                      {option.id === selector.defaultId ? (
                        <span className="rounded bg-surface-sunken px-1 text-2xs text-muted-foreground">Padrão</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.description} · {statusLabelFor(option)}
                    </span>
                  </span>
                  {isSelected ? <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden /> : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default InstanceSelector;
