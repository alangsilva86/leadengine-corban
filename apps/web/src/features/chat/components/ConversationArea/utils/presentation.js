import { format, isToday, isYesterday, isThisYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Archive, CheckCircle2, CircleDashed, Clock3, HelpCircle, Mail, MessageCircle, Phone, UserCheck } from 'lucide-react';

/**
 * Fonte única de apresentação do Inbox: tons, canais, status, horários e
 * resolução de campos que antes eram repetidos em vários componentes.
 */

/** Classes de "chip" por tom — somente tokens semânticos. */
const TONE_CHIP_CLASSES = {
  neutral: 'border-border bg-surface-sunken text-muted-foreground',
  info: 'border-border bg-surface-sunken text-foreground',
  primary: 'border-transparent bg-primary-soft text-primary-soft-foreground',
  success: 'border-transparent bg-success-soft text-success-soft-foreground',
  warning: 'border-transparent bg-warning-soft text-warning-soft-foreground',
  danger: 'border-transparent bg-danger-soft text-danger-soft-foreground',
  whatsapp: 'border-transparent bg-whatsapp-soft text-whatsapp-soft-foreground',
};

export const resolveToneChipClass = (tone) => TONE_CHIP_CLASSES[tone] ?? TONE_CHIP_CLASSES.neutral;

const STATUS_PRESENTATION = {
  OPEN: { label: 'Aberta', tone: 'info', icon: CircleDashed },
  PENDING: { label: 'Pendente', tone: 'warning', icon: Clock3 },
  ASSIGNED: { label: 'Em atendimento', tone: 'info', icon: UserCheck },
  RESOLVED: { label: 'Resolvida', tone: 'success', icon: CheckCircle2 },
  CLOSED: { label: 'Encerrada', tone: 'neutral', icon: Archive },
};

export const getStatusInfo = (status) => {
  const normalized = status ? String(status).toUpperCase() : 'OPEN';
  const presentation = STATUS_PRESENTATION[normalized];
  return presentation ?? { label: normalized, tone: 'neutral', icon: HelpCircle };
};

export const isTicketClosed = (ticket) => {
  const status = typeof ticket?.status === 'string' ? ticket.status.toUpperCase() : '';
  return status === 'CLOSED' || status === 'RESOLVED';
};

const CHANNEL_PRESENTATION = {
  WHATSAPP: { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, tone: 'whatsapp' },
  VOICE: { id: 'voice', label: 'Telefone', icon: Phone, tone: 'neutral' },
  EMAIL: { id: 'email', label: 'E-mail', icon: Mail, tone: 'neutral' },
  DEFAULT: { id: 'unknown', label: 'Canal não identificado', icon: MessageCircle, tone: 'neutral' },
};

export const normalizeChannel = (value) => {
  if (!value) return null;
  const normalized = String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase();
  if (!normalized) return null;
  if (normalized === 'PHONE' || normalized === 'TELEFONE' || normalized === 'CALL') return 'VOICE';
  if (normalized === 'E-MAIL' || normalized === 'MAIL') return 'EMAIL';
  if (normalized === 'WA') return 'WHATSAPP';
  return normalized;
};

export const resolveChannelInfo = (channel) =>
  CHANNEL_PRESENTATION[normalizeChannel(channel)] ?? CHANNEL_PRESENTATION.DEFAULT;

/** A conversa nasceu no WhatsApp? (canal do ticket, metadados ou origem). */
export const isWhatsAppTicket = (ticket) => {
  if (!ticket) return false;
  const candidates = [
    ticket.channel,
    ticket.metadata?.channel,
    ticket.metadata?.origin,
    ticket.metadata?.source,
    ticket.origin,
    ticket.source,
  ];
  if (candidates.some((value) => normalizeChannel(value) === 'WHATSAPP')) return true;
  const meta = ticket.metadata ?? {};
  return Boolean(meta.whatsapp || meta.remoteJid || meta.sourceInstance || meta.instanceId || ticket.instanceId);
};

const pickString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
};

/** Número (instância) de WhatsApp pelo qual a conversa chegou. */
export const resolveTicketInstanceId = (ticket) => {
  if (!ticket) return null;
  const metadata = ticket.metadata && typeof ticket.metadata === 'object' ? ticket.metadata : {};
  const whatsapp = metadata.whatsapp && typeof metadata.whatsapp === 'object' ? metadata.whatsapp : {};
  return pickString(
    metadata.sourceInstance,
    ticket.instanceId,
    metadata.instanceId,
    whatsapp.instanceId,
    metadata.instance_id,
    whatsapp.instance_id,
    metadata.whatsappInstanceId,
    ticket.timeline?.instanceId,
  );
};

export const getFirstName = (value) => {
  if (typeof value !== 'string') return null;
  const [first] = value.trim().split(/\s+/);
  return first || null;
};

/** Preenche variáveis conhecidas de modelos e respostas rápidas ({{nome}}). */
export const fillTemplatePlaceholders = (text, { contactName } = {}) => {
  if (typeof text !== 'string') return '';
  const firstName = getFirstName(contactName);
  return text.replace(/\{\{\s*(nome|name|primeiro_nome|first_name)\s*\}\}/gi, () => firstName ?? '').replace(/ {2,}/g, ' ').replace(/ ,/g, ',');
};

export const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "14:32" hoje, "Ontem", "12/11" neste ano, "12/11/24" antes. */
export const formatListTimestamp = (value) => {
  const date = parseDate(value);
  if (!date) return null;
  if (isToday(date)) return format(date, 'HH:mm', { locale: ptBR });
  if (isYesterday(date)) return 'Ontem';
  if (isThisYear(date)) return format(date, 'dd/MM', { locale: ptBR });
  return format(date, 'dd/MM/yy', { locale: ptBR });
};

export const formatMessageTime = (value) => {
  const date = parseDate(value);
  return date ? format(date, 'HH:mm', { locale: ptBR }) : '';
};

/** "agora", "12 min", "2 h", "3 d". */
export const formatShortDuration = (ms) => {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return 'menos de 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} d`;
};

/** Momento da última atividade da conversa (para ordenar e exibir na lista). */
export const resolveLastActivityAt = (ticket) => {
  const timeline = ticket?.timeline ?? {};
  const candidates = [ticket?.lastMessageAt, timeline.lastInboundAt, timeline.lastOutboundAt, ticket?.updatedAt, ticket?.createdAt]
    .map(parseDate)
    .filter(Boolean);
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, current) => (current > latest ? current : latest));
};

// Meta de primeira resposta: acima disso, "Aguardando há …" fica em tom de alerta.
const RESPONSE_TARGET_MINUTES = 15;

/** Cliente esperando resposta? Devolve há quanto tempo e se passou da meta. */
export const resolveWaitingState = (ticket, now = Date.now()) => {
  const timeline = ticket?.timeline ?? {};
  if (timeline.lastDirection !== 'INBOUND') return null;
  const since = parseDate(timeline.lastInboundAt);
  if (!since) return null;
  const elapsed = now - since.getTime();
  return {
    since,
    elapsedMs: elapsed,
    label: `Aguardando há ${formatShortDuration(elapsed)}`,
    shortLabel: `Aguarda há ${formatShortDuration(elapsed)}`,
    overdue: elapsed > RESPONSE_TARGET_MINUTES * 60000,
  };
};

/**
 * Janela de 24 h do WhatsApp (a API informa `window.isOpen/expiresAt`).
 * `state`: 'open' | 'closing' | 'closed' | 'none' (cliente ainda não escreveu).
 */
export const resolveWindowState = (ticket, now = Date.now()) => {
  const windowInfo = ticket?.window ?? null;
  const expiresAt = parseDate(windowInfo?.expiresAt);
  const hadInbound = Boolean(ticket?.timeline?.lastInboundAt || ticket?.timeline?.firstInboundAt);

  if (windowInfo?.isOpen === true || (expiresAt && expiresAt.getTime() > now)) {
    const remainingMs = expiresAt ? expiresAt.getTime() - now : null;
    const remainingLabel = remainingMs !== null ? formatShortDuration(remainingMs) : null;
    const closing = remainingMs !== null && remainingMs <= 2 * 60 * 60 * 1000;
    return {
      state: closing ? 'closing' : 'open',
      isOpen: true,
      expiresAt,
      remainingMs,
      label: remainingLabel ? `Janela de 24 h aberta · fecha em ${remainingLabel}` : 'Janela de 24 h aberta',
      shortLabel: remainingLabel ? `Janela fecha em ${remainingLabel}` : null,
    };
  }

  if (!hadInbound) {
    return {
      state: 'none',
      isOpen: false,
      expiresAt: null,
      remainingMs: null,
      label: 'O cliente ainda não escreveu. Para iniciar, prefira um modelo aprovado.',
      shortLabel: null,
    };
  }

  return {
    state: 'closed',
    isOpen: false,
    expiresAt,
    remainingMs: null,
    label: 'A janela de 24 h encerrou. Envie um modelo aprovado para retomar.',
    shortLabel: 'Janela encerrada',
  };
};

/** Responsável pela conversa. */
export const resolveTicketAssignee = (ticket, currentUser = null) => {
  if (!ticket) return null;
  const id = pickString(
    ticket.userId != null ? String(ticket.userId) : null,
    ticket.assigneeId != null ? String(ticket.assigneeId) : null,
    ticket.assignee?.id != null ? String(ticket.assignee.id) : null,
    ticket.user?.id != null ? String(ticket.user.id) : null,
  );
  if (!id) return null;
  const isCurrentUser = Boolean(currentUser?.id && String(currentUser.id) === id);
  const name = pickString(
    isCurrentUser ? currentUser?.name : null,
    ticket.assignee?.name,
    ticket.assignee?.fullName,
    ticket.assigneeName,
    ticket.user?.name,
    ticket.user?.fullName,
    ticket.userName,
    ticket.metadata?.assigneeName,
  );
  return { id, name, isCurrentUser };
};

/** Prévia da última mensagem para a lista. */
export const resolveTicketPreview = (ticket) => {
  const preview = pickString(ticket?.lastMessagePreview, ticket?.metadata?.lastMessagePreview);
  if (preview) return preview;
  const count = ticket?.timeline?.messageCount;
  if (typeof count === 'number' && count === 0) return 'Nenhuma mensagem ainda';
  if (ticket?.timeline?.lastDirection === 'INBOUND') return 'Nova mensagem do cliente';
  if (ticket?.timeline?.lastDirection === 'OUTBOUND') return 'Mensagem enviada';
  return 'Nenhuma mensagem ainda';
};

/** Sentence case para nomes de número/instância exibidos em caixa alta. */
const LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no']);

/** "CORBAN SP" → "Corban SP"; siglas curtas (SP, RJ, INSS) ficam em maiúsculas. */
export const toSentenceCase = (value) => {
  if (typeof value !== 'string' || !value.trim()) return value;
  const trimmed = value.trim();
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
      if (/^\p{L}{2,4}$/u.test(word) && index > 0) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
};

const AUTHOR_KIND_ALIASES = {
  ai: 'ai',
  ia: 'ai',
  bot: 'ai',
  copilot: 'ai',
  assistant: 'ai',
  automation: 'automation',
  automacao: 'automation',
  automação: 'automation',
  campaign: 'automation',
  campanha: 'automation',
  workflow: 'automation',
  system: 'automation',
  agent: 'agent',
  user: 'agent',
  human: 'agent',
};

/**
 * Autor de uma mensagem enviada: "Você", nome do agente, "IA" ou "Automação".
 * Devolve `null` quando os dados não permitem saber (nesse caso não exibimos rótulo).
 */
export const resolveMessageAuthor = (message, currentUser = null) => {
  if (!message || typeof message !== 'object') return null;
  const direction = typeof message.direction === 'string' ? message.direction.toLowerCase() : 'inbound';
  if (direction !== 'outbound') return null;
  const metadata = message.metadata && typeof message.metadata === 'object' ? message.metadata : {};

  const rawKind = pickString(
    metadata.sentBy,
    metadata.senderType,
    metadata.authorType,
    metadata.origin,
    metadata.source,
    metadata.author?.type,
  );
  const kind = rawKind ? AUTHOR_KIND_ALIASES[rawKind.toLowerCase()] ?? null : null;
  if (kind === 'ai' || metadata.ai === true || metadata.aiGenerated === true) {
    return { key: 'ai', label: 'IA' };
  }
  if (kind === 'automation' || metadata.campaignId || metadata.automation === true) {
    return { key: 'automation', label: 'Automação' };
  }

  const userId = message.userId ?? metadata.userId ?? metadata.agentId ?? metadata.author?.id ?? null;
  if (userId && currentUser?.id && String(userId) === String(currentUser.id)) {
    return { key: `user:${userId}`, label: 'Você' };
  }
  const name = pickString(metadata.agentName, metadata.userName, metadata.author?.name, message.user?.name, message.userName);
  if (name) {
    return { key: `user:${userId ?? name}`, label: name };
  }
  if (userId) {
    return { key: `user:${userId}`, label: 'Equipe' };
  }
  return null;
};
