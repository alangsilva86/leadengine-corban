import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  CheckSquare,
  FileText,
  Globe,
  Handshake,
  Mail,
  Megaphone,
  MessageCircle,
  Phone,
  Repeat,
  Share2,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import { toDate } from '@/lib/relative-time';

/**
 * Rótulos pt-BR para os identificadores que chegam da API do CRM.
 * Nunca mostre o valor cru ("whatsapp", "note") na interface.
 * Etapas do lead: use `./lead-stage` (funil único do contrato).
 */

/** Origens possíveis do lead (enum LeadSource da API, em minúsculas). */
export const LEAD_SOURCES: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'website', label: 'Site', icon: Globe },
  { id: 'paid_ads', label: 'Anúncios', icon: Megaphone },
  { id: 'social_media', label: 'Redes sociais', icon: Share2 },
  { id: 'referral', label: 'Indicação', icon: Users },
  { id: 'partner', label: 'Parceiro', icon: Handshake },
  { id: 'import', label: 'Importação', icon: Upload },
  { id: 'organic', label: 'Orgânico', icon: Sparkles },
  { id: 'email', label: 'E-mail', icon: Mail },
  { id: 'phone', label: 'Telefone', icon: Phone },
  { id: 'event', label: 'Evento', icon: CalendarClock },
  { id: 'other', label: 'Outra origem', icon: FileText },
];

const SOURCE_BY_ID = new Map(LEAD_SOURCES.map((source) => [source.id, source]));
// Aliases aceitos pelo filtro da API.
const SOURCE_ALIASES: Record<string, string> = { web: 'website', ads: 'paid_ads', social: 'social_media' };

const resolveSource = (value: string | null | undefined) => {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SOURCE_BY_ID.get(SOURCE_ALIASES[key] ?? key) ?? null;
};

export const getSourceLabel = (value: string | null | undefined) => resolveSource(value)?.label ?? null;
export const getSourceIcon = (value: string | null | undefined): LucideIcon => resolveSource(value)?.icon ?? FileText;

export const TIMELINE_EVENT_TYPES: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'message', label: 'Mensagem', icon: MessageCircle },
  { id: 'call', label: 'Ligação', icon: Phone },
  { id: 'meeting', label: 'Reunião', icon: CalendarClock },
  { id: 'task', label: 'Tarefa', icon: CheckSquare },
  { id: 'status_change', label: 'Mudança de etapa', icon: Repeat },
  { id: 'note', label: 'Anotação', icon: FileText },
];

const EVENT_BY_ID = new Map(TIMELINE_EVENT_TYPES.map((entry) => [entry.id, entry]));

export const getTimelineEventLabel = (type: string | null | undefined) =>
  EVENT_BY_ID.get(String(type ?? '').toLowerCase())?.label ?? 'Atividade';

export const getTimelineEventIcon = (type: string | null | undefined): LucideIcon =>
  EVENT_BY_ID.get(String(type ?? '').toLowerCase())?.icon ?? FileText;

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export const formatCount = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

export const pluralize = (count: number, singular: string, plural: string) =>
  `${formatCount(count)} ${count === 1 ? singular : plural}`;

export const formatDateTime = (value: string | number | Date | null | undefined) => {
  const date = toDate(value);
  if (!date) return null;
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

export type IdleTone = 'default' | 'warning' | 'danger';

/** Lead parado: alerta após 48 h e crítico após 72 h sem atividade. */
export const getIdleTone = (value: string | number | Date | null | undefined, now = Date.now()): IdleTone => {
  const date = toDate(value);
  if (!date) return 'default';
  const hours = (now - date.getTime()) / 3_600_000;
  if (hours >= 72) return 'danger';
  if (hours >= 48) return 'warning';
  return 'default';
};

export const IDLE_TONE_CLASS: Record<IdleTone, string> = {
  default: 'text-muted-foreground',
  warning: 'text-warning-soft-foreground',
  danger: 'text-danger-soft-foreground',
};

/** Link para abrir a conversa do contato no Inbox (o Inbox resolve o ticket a partir do contato). */
export const buildInboxHref = (contactId: string | null | undefined) =>
  contactId ? `/inbox?${new URLSearchParams({ contactId })}` : '/inbox';

// ---------------------------------------------------------------------------
// Oportunidades (proposta de consignado)
// ---------------------------------------------------------------------------

/** Sugestões para os campos livres da oportunidade (o payload continua texto livre). */
export const AGREEMENT_SUGGESTIONS = ['INSS', 'SIAPE', 'Governo estadual', 'Prefeitura', 'Forças Armadas'];
export const PRODUCT_SUGGESTIONS = ['Consignado novo', 'Refinanciamento', 'Portabilidade', 'Cartão benefício', 'Cartão consignado'];
