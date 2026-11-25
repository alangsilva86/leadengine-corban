import { Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import useTicketJro from '../../../hooks/useTicketJro.js';
import { formatShortDuration, resolveToneChipClass } from '../utils/presentation.js';

export const HEADER_CHIP_BASE =
  'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium';

const hasInternalSla = (ticket) =>
  Boolean(ticket?.metadata?.internalSla || ticket?.metadata?.jro || ticket?.sla?.internal);

/** Chip de tempo — só quando há algo útil a dizer. */
export const resolveTimeChip = ({ ticket, jro, windowState, waiting }) => {
  // O prazo interno só vale quando configurado (a janela de 24 h não é prazo de resposta).
  if (hasInternalSla(ticket) && jro?.deadline && typeof jro.msRemaining === 'number') {
    if (jro.msRemaining < 0) {
      return { label: `Atrasada há ${formatShortDuration(-jro.msRemaining)}`, tone: 'danger', description: 'Prazo interno de resposta' };
    }
    return {
      label: `Responder em ${formatShortDuration(jro.msRemaining)}`,
      tone: jro.state === 'orange' || jro.state === 'yellow' ? 'warning' : 'neutral',
      description: 'Prazo interno de resposta',
    };
  }
  if (windowState?.state === 'closing' && windowState.shortLabel) {
    return { label: windowState.shortLabel, tone: 'warning', description: 'Janela de 24 h do WhatsApp' };
  }
  if (waiting?.overdue) {
    return { label: waiting.label, tone: 'warning', description: 'Cliente esperando resposta' };
  }
  return null;
};

/**
 * O prazo interno (JRO) é contado a cada segundo; esse relógio fica só neste chip, para não
 * re-renderizar o cabeçalho inteiro da conversa a cada tique.
 */
const TicketTimeChip = ({ ticket, windowState = null, waiting = null }) => {
  const jro = useTicketJro(ticket);
  const timeChip = resolveTimeChip({ ticket, jro, windowState, waiting });
  if (!timeChip?.label) return null;
  return (
    <span
      className={cn(HEADER_CHIP_BASE, resolveToneChipClass(timeChip.tone ?? 'neutral'))}
      title={timeChip.description ?? undefined}
    >
      <Clock3 className="size-3.5" aria-hidden />
      <span className="truncate">{timeChip.label}</span>
    </span>
  );
};

export default TicketTimeChip;
