import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  CircleDot,
  CircleX,
  ClipboardCheck,
  FileSignature,
  FileText,
  Landmark,
  MessageCircle,
  RefreshCcw,
  Trophy,
} from 'lucide-react';
import {
  LEAD_PIPELINE_STAGES,
  LEAD_STAGES,
  LEAD_STAGE_DEFINITIONS,
  LEGACY_LEAD_STATUS_TO_LEAD_STAGE,
  LEGACY_OPPORTUNITY_STAGE_TO_LEAD_STAGE,
  LEGACY_TICKET_STAGE_TO_LEAD_STAGE,
  canTransitionLeadStage,
  isLeadStage,
  type LeadStage,
  type LeadStageDefinition,
  type LeadStageTone,
} from '@ticketz/contracts';

/**
 * Apresentação do funil único do lead (Inbox, CRM, Contatos e Oportunidades).
 * Rótulos, ordem e regras de transição vêm do contrato (`@ticketz/contracts`);
 * aqui ficam só ícones, classes de tom e a normalização tolerante de valores antigos.
 */

export type { LeadStage, LeadStageTone };
export { LEAD_PIPELINE_STAGES, LEAD_STAGES, LEAD_STAGE_DEFINITIONS, canTransitionLeadStage, isLeadStage };

/** Saídas do funil (Ganho, Perdido, Reciclar), na ordem do contrato. */
export const LEAD_EXIT_STAGES: readonly LeadStage[] = LEAD_STAGES.filter((stage) => LEAD_STAGE_DEFINITIONS[stage].exit);

export const LEAD_STAGE_ICONS: Record<LeadStage, LucideIcon> = {
  novo: CircleDot,
  contato: MessageCircle,
  qualificacao: ClipboardCheck,
  proposta: FileText,
  documentacao: FileSignature,
  averbacao: Landmark,
  liquidacao: Banknote,
  ganho: Trophy,
  perdido: CircleX,
  reciclar: RefreshCcw,
};

export type LeadStageBadgeVariant = 'secondary' | 'info' | 'primary' | 'warning' | 'success' | 'destructive';

type ToneClasses = {
  /** Fundo + texto "soft" (chips, pílulas). */
  chip: string;
  /** Ponto/indicador sólido. */
  dot: string;
  /** Texto no tom, sobre superfície neutra. */
  text: string;
  /** Borda no tom (colunas, cartões em destaque). */
  border: string;
  /** Variante equivalente do `Badge`. */
  badge: LeadStageBadgeVariant;
};

/** Tom do contrato → classes semânticas do design system (nunca cores da paleta). */
export const LEAD_STAGE_TONE_CLASSES: Record<LeadStageTone, ToneClasses> = {
  neutral: {
    chip: 'bg-surface-sunken text-muted-foreground',
    dot: 'bg-subtle-foreground',
    text: 'text-muted-foreground',
    border: 'border-border-strong',
    badge: 'secondary',
  },
  info: {
    chip: 'bg-info-soft text-info-soft-foreground',
    dot: 'bg-info',
    text: 'text-info-soft-foreground',
    border: 'border-info',
    badge: 'info',
  },
  primary: {
    chip: 'bg-primary-soft text-primary-soft-foreground',
    dot: 'bg-primary',
    text: 'text-primary-soft-foreground',
    border: 'border-primary',
    badge: 'primary',
  },
  warning: {
    chip: 'bg-warning-soft text-warning-soft-foreground',
    dot: 'bg-warning',
    text: 'text-warning-soft-foreground',
    border: 'border-warning',
    badge: 'warning',
  },
  success: {
    chip: 'bg-success-soft text-success-soft-foreground',
    dot: 'bg-success',
    text: 'text-success-soft-foreground',
    border: 'border-success',
    badge: 'success',
  },
  danger: {
    chip: 'bg-danger-soft text-danger-soft-foreground',
    dot: 'bg-danger',
    text: 'text-danger-soft-foreground',
    border: 'border-danger',
    badge: 'destructive',
  },
};

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

/** Ids antigos do Kanban do CRM (antes do funil único). */
const LEGACY_CRM_STAGE_TO_LEAD_STAGE: Record<string, LeadStage> = {
  qualification: 'qualificacao',
  proposal: 'proposta',
  negotiation: 'documentacao',
  closed_won: 'ganho',
  won: 'ganho',
  closed_lost: 'perdido',
  lost: 'perdido',
  // Inbox (aliases livres que chegavam em `pipelineStep`).
  qualificando: 'qualificacao',
  documentando: 'documentacao',
  averbando: 'averbacao',
  liquidando: 'liquidacao',
  reciclando: 'reciclar',
  aprovado: 'ganho',
};

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** "Em contato" → contato, "Qualificação" → qualificacao (rótulos exibidos também são aceitos). */
const LABEL_TO_STAGE: Record<string, LeadStage> = Object.fromEntries(
  LEAD_STAGES.map((stage) => [slugify(LEAD_STAGE_DEFINITIONS[stage].label), stage]),
);

/**
 * Converte qualquer valor conhecido (id novo, rótulo, valor legado do Inbox, do CRM ou de
 * oportunidade) em `LeadStage`. Retorna `null` quando o valor está vazio ou é desconhecido.
 */
export const parseLeadStage = (value: unknown): LeadStage | null => {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  if (isLeadStage(raw)) return raw;

  const slug = slugify(raw);
  if (!slug) return null;
  if (isLeadStage(slug)) return slug;

  return (
    LEGACY_TICKET_STAGE_TO_LEAD_STAGE[slug] ??
    LEGACY_CRM_STAGE_TO_LEAD_STAGE[slug] ??
    LABEL_TO_STAGE[slug] ??
    LEGACY_LEAD_STATUS_TO_LEAD_STAGE[slug.toUpperCase()] ??
    LEGACY_OPPORTUNITY_STAGE_TO_LEAD_STAGE[slug.toUpperCase()] ??
    null
  );
};

/** Igual a `parseLeadStage`, mas sempre devolve uma etapa (padrão: "Novo"). */
export const normalizeLeadStage = (value: unknown, fallback: LeadStage = 'novo'): LeadStage =>
  parseLeadStage(value) ?? fallback;

// ---------------------------------------------------------------------------
// Apresentação e regras
// ---------------------------------------------------------------------------

export type LeadStagePresentation = LeadStageDefinition & {
  icon: LucideIcon;
  classes: ToneClasses;
};

export const getLeadStagePresentation = (value: unknown): LeadStagePresentation => {
  const stage = normalizeLeadStage(value);
  const definition = LEAD_STAGE_DEFINITIONS[stage];
  return { ...definition, icon: LEAD_STAGE_ICONS[stage], classes: LEAD_STAGE_TONE_CLASSES[definition.tone] };
};

export const getLeadStageLabel = (value: unknown) => LEAD_STAGE_DEFINITIONS[normalizeLeadStage(value)].label;

export const getLeadStageBadgeVariant = (value: unknown): LeadStageBadgeVariant =>
  LEAD_STAGE_TONE_CLASSES[LEAD_STAGE_DEFINITIONS[normalizeLeadStage(value)].tone].badge;

/** Posição no funil (1..10) — para ordenar listas por etapa. */
export const getLeadStageOrder = (value: unknown) => LEAD_STAGE_DEFINITIONS[normalizeLeadStage(value)].order;

/** Etapa de saída que encerra o lead (Ganho ou Perdido). */
export const isClosedLeadStage = (value: unknown) => {
  const stage = parseLeadStage(value);
  return stage ? LEAD_STAGE_DEFINITIONS[stage].terminal : false;
};

/** Frase curta explicando por que a mudança não é permitida (ou `null` quando é). */
export const getLeadStageTransitionBlockReason = (from: LeadStage, to: LeadStage): string | null => {
  if (canTransitionLeadStage(from, to)) return null;
  if (from === 'ganho') return 'Lead ganho é final: a etapa não muda mais.';
  if (from === 'perdido') return 'Lead perdido só pode voltar para Reciclar.';
  return 'Essa mudança de etapa não é permitida.';
};

export type LeadStageOption = {
  id: LeadStage;
  label: string;
  description: string;
  tone: LeadStageTone;
  exit: boolean;
  current: boolean;
  disabled: boolean;
  /** Motivo quando `disabled`. */
  reason: string | null;
};

/** Todas as etapas (funil + saídas), marcando a atual e as transições bloqueadas a partir dela. */
export const getLeadStageOptions = (from: unknown): LeadStageOption[] => {
  const current = normalizeLeadStage(from);
  return LEAD_STAGES.map((id) => {
    const definition = LEAD_STAGE_DEFINITIONS[id];
    const reason = getLeadStageTransitionBlockReason(current, id);
    return {
      id,
      label: definition.label,
      description: definition.description,
      tone: definition.tone,
      exit: definition.exit,
      current: id === current,
      disabled: Boolean(reason),
      reason,
    };
  });
};

/** Etapas para onde o lead pode ir a partir da atual (sem incluir a própria). */
export const getAllowedLeadStageTargets = (from: unknown): LeadStage[] => {
  const current = normalizeLeadStage(from);
  return LEAD_STAGES.filter((stage) => stage !== current && canTransitionLeadStage(current, stage));
};

/** Opções de filtro (id + rótulo), na ordem do funil. */
export const LEAD_STAGE_FILTER_OPTIONS = LEAD_STAGES.map((id) => ({ id, label: LEAD_STAGE_DEFINITIONS[id].label }));
