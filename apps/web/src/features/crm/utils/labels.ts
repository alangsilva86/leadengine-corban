import { format, formatDistanceToNow } from 'date-fns';
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

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export const formatBRL = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
    return null;
  }
  return currencyFormatter.format(value);
};

export const formatCount = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

export const pluralize = (count: number, singular: string, plural: string) =>
  `${formatCount(count)} ${count === 1 ? singular : plural}`;

export const toDate = (value: string | number | Date | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

/** "agora", "há 5 min", "há 3 h", "há 2 d", depois a data curta ("12 de jun."). */
export const formatRelativeShort = (value: string | number | Date | null | undefined, now = Date.now()) => {
  const date = toDate(value);
  if (!date) return null;
  const diffMinutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (diffMinutes < 1) return 'agora';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `há ${diffDays} d`;
  return format(date, "d 'de' MMM", { locale: ptBR });
};

export const formatRelativeLong = (value: string | number | Date | null | undefined) => {
  const date = toDate(value);
  if (!date) return null;
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
};

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

export const getInitials = (name: string | null | undefined, fallback = '?') => {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
