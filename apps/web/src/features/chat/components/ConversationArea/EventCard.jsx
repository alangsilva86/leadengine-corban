import { CircleDollarSign, ClipboardList, FileText, History } from 'lucide-react';
import { formatMessageTime } from './utils/presentation.js';

const TYPE_ICONS = {
  simulation: ClipboardList,
  proposal: FileText,
  deal: CircleDollarSign,
};

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
};

/** Resumo legível de uma simulação/proposta (nunca JSON cru). */
export const summarizeSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const bank = snapshot.bank?.label ?? snapshot.bank?.name ?? (typeof snapshot.bank === 'string' ? snapshot.bank : null);
  const term = toNumber(snapshot.term ?? snapshot.prazo);
  const installment = toNumber(snapshot.installment ?? snapshot.installmentValue ?? snapshot.parcela);
  const net = toNumber(snapshot.netAmount ?? snapshot.netValue ?? snapshot.valorLiquido);
  const parts = [
    bank,
    term && installment ? `${term}x de ${currency.format(installment)}` : term ? `${term}x` : installment ? `parcela ${currency.format(installment)}` : null,
    net ? `líquido ${currency.format(net)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
};

/**
 * Evento da conversa (simulação, proposta, venda, mudanças): pílula discreta e centralizada.
 */
export const EventCard = ({ entry }) => {
  if (!entry) return null;
  const payload = entry.payload ?? {};
  const Icon = TYPE_ICONS[entry.type] ?? History;
  const label = payload.label ?? entry.label ?? 'Atualização';
  const description =
    (typeof payload.description === 'string' && payload.description.trim()) ||
    summarizeSnapshot(payload.calculationSnapshot ?? payload.snapshot ?? null) ||
    (payload.stageLabel ? `Etapa: ${payload.stageLabel}` : null);
  const time = formatMessageTime(entry.date);

  return (
    <div className="my-2 flex justify-center" role="note">
      <div className="inline-flex min-w-0 max-w-[90%] items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="shrink-0 whitespace-nowrap font-medium text-foreground">{label}</span>
        {description ? <span className="min-w-0 truncate">· {description}</span> : null}
        {time ? <span className="shrink-0 text-subtle-foreground">· {time}</span> : null}
      </div>
    </div>
  );
};

export default EventCard;
