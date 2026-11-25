/**
 * Funil único do lead — a mesma lista de etapas no Inbox, no CRM e nas Oportunidades.
 *
 * O lead é o dono da etapa. O Inbox (conversas) e o CRM (Kanban) mostram e alteram a etapa do lead;
 * as oportunidades (propostas de consignado) usam a mesma lista para o próprio andamento.
 *
 * Os mapeamentos "legados" existem só para migrar dados e para integrações que ainda leem
 * `Lead.status` (LeadStatus) — novas telas e rotas devem usar apenas `LeadStage`.
 */

export const LEAD_STAGES = [
  'novo',
  'contato',
  'qualificacao',
  'proposta',
  'documentacao',
  'averbacao',
  'liquidacao',
  'ganho',
  'perdido',
  'reciclar',
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export type LeadStageTone = 'neutral' | 'info' | 'primary' | 'warning' | 'success' | 'danger';

export interface LeadStageDefinition {
  id: LeadStage;
  /** Rótulo exibido na interface (pt-BR). */
  label: string;
  /** Frase curta para tooltips e ajuda contextual. */
  description: string;
  /** Posição no funil (1..7). Etapas de saída (ganho, perdido, reciclar) não entram na sequência. */
  order: number;
  /** Encerra o lead: não avança mais. */
  terminal: boolean;
  /** Etapa de saída do funil principal (ganho, perdido ou reciclar). */
  exit: boolean;
  tone: LeadStageTone;
}

export const LEAD_STAGE_DEFINITIONS: Record<LeadStage, LeadStageDefinition> = {
  novo: {
    id: 'novo',
    label: 'Novo',
    description: 'Lead recém-chegado, ainda sem contato.',
    order: 1,
    terminal: false,
    exit: false,
    tone: 'neutral',
  },
  contato: {
    id: 'contato',
    label: 'Em contato',
    description: 'Conversa iniciada; aguardando entender a necessidade do cliente.',
    order: 2,
    terminal: false,
    exit: false,
    tone: 'info',
  },
  qualificacao: {
    id: 'qualificacao',
    label: 'Qualificação',
    description: 'Consulta de margem, convênio e elegibilidade.',
    order: 3,
    terminal: false,
    exit: false,
    tone: 'info',
  },
  proposta: {
    id: 'proposta',
    label: 'Proposta',
    description: 'Simulação apresentada ao cliente.',
    order: 4,
    terminal: false,
    exit: false,
    tone: 'primary',
  },
  documentacao: {
    id: 'documentacao',
    label: 'Documentação',
    description: 'Coleta de documentos e assinatura.',
    order: 5,
    terminal: false,
    exit: false,
    tone: 'primary',
  },
  averbacao: {
    id: 'averbacao',
    label: 'Averbação',
    description: 'Contrato digitado e em averbação no convênio.',
    order: 6,
    terminal: false,
    exit: false,
    tone: 'warning',
  },
  liquidacao: {
    id: 'liquidacao',
    label: 'Liquidação',
    description: 'Aguardando a liberação do crédito ao cliente.',
    order: 7,
    terminal: false,
    exit: false,
    tone: 'warning',
  },
  ganho: {
    id: 'ganho',
    label: 'Ganho',
    description: 'Crédito liberado. Venda concluída.',
    order: 8,
    terminal: true,
    exit: true,
    tone: 'success',
  },
  perdido: {
    id: 'perdido',
    label: 'Perdido',
    description: 'O cliente desistiu ou não é elegível.',
    order: 9,
    terminal: true,
    exit: true,
    tone: 'danger',
  },
  reciclar: {
    id: 'reciclar',
    label: 'Reciclar',
    description: 'Voltar a oferecer mais tarde (ex.: sem margem agora).',
    order: 10,
    terminal: false,
    exit: true,
    tone: 'neutral',
  },
};

/** Etapas do funil principal, em ordem (sem as saídas). */
export const LEAD_PIPELINE_STAGES: readonly LeadStage[] = LEAD_STAGES.filter(
  (stage) => !LEAD_STAGE_DEFINITIONS[stage].exit,
);

export const DEFAULT_LEAD_STAGE: LeadStage = 'novo';

export const isLeadStage = (value: unknown): value is LeadStage =>
  typeof value === 'string' && (LEAD_STAGES as readonly string[]).includes(value);

export const getLeadStageLabel = (stage: unknown): string =>
  isLeadStage(stage) ? LEAD_STAGE_DEFINITIONS[stage].label : LEAD_STAGE_DEFINITIONS[DEFAULT_LEAD_STAGE].label;

/**
 * Regra de transição: qualquer etapa aberta pode ir para qualquer outra (operadores corrigem erros),
 * mas "ganho" e "perdido" encerram o lead — para reabrir, use "reciclar" (exceto a partir de "ganho").
 */
export const canTransitionLeadStage = (from: LeadStage, to: LeadStage): boolean => {
  if (from === to) return true;
  if (from === 'ganho') return false;
  if (from === 'perdido') return to === 'reciclar';
  return true;
};

// ---------------------------------------------------------------------------
// Mapeamentos legados (migração de dados e compatibilidade com integrações)
// ---------------------------------------------------------------------------

/** Antigo `TicketStage` (Inbox) → etapa do lead. */
export const LEGACY_TICKET_STAGE_TO_LEAD_STAGE: Record<string, LeadStage> = {
  novo: 'novo',
  desconhecido: 'novo',
  conectado: 'contato',
  aguardando: 'contato',
  qualificacao: 'qualificacao',
  proposta: 'proposta',
  documentacao: 'documentacao',
  // "aguardando cliente" era usado para aguardar documentos/assinatura.
  aguardando_cliente: 'documentacao',
  documentos_averbacao: 'averbacao',
  liquidacao: 'liquidacao',
  aprovado_liquidacao: 'ganho',
  reciclar: 'reciclar',
};

/** Antigo `LeadStatus` (CRM) → etapa do lead. */
export const LEGACY_LEAD_STATUS_TO_LEAD_STAGE: Record<string, LeadStage> = {
  NEW: 'novo',
  CONTACTED: 'contato',
  ENGAGED: 'contato',
  QUALIFIED: 'qualificacao',
  PROPOSAL: 'proposta',
  NEGOTIATION: 'documentacao',
  CONVERTED: 'ganho',
  LOST: 'perdido',
  NURTURING: 'reciclar',
};

/**
 * Etapa do lead → `LeadStatus` espelhado (mantido em sincronia para integrações que ainda leem o status).
 */
export const LEAD_STAGE_TO_LEGACY_LEAD_STATUS: Record<LeadStage, string> = {
  novo: 'NEW',
  contato: 'CONTACTED',
  qualificacao: 'QUALIFIED',
  proposta: 'PROPOSAL',
  documentacao: 'NEGOTIATION',
  averbacao: 'NEGOTIATION',
  liquidacao: 'NEGOTIATION',
  ganho: 'CONVERTED',
  perdido: 'LOST',
  reciclar: 'NURTURING',
};

/**
 * Antigo `OpportunityStage` → etapa. `CLOSED` não dizia se foi ganho ou perdido:
 * a migração usa o status do lead vinculado (CONVERTED → ganho; caso contrário → perdido).
 */
export const LEGACY_OPPORTUNITY_STAGE_TO_LEAD_STAGE: Record<string, LeadStage> = {
  QUALIFICATION: 'qualificacao',
  PREPARATION: 'proposta',
  FOLLOW_UP: 'averbacao',
  CLOSED: 'perdido',
};

/** Etapas que encerram o lead (fora do funil "aberto" do CRM). */
export const CLOSED_LEAD_STAGES: readonly LeadStage[] = LEAD_STAGES.filter(
  (stage) => LEAD_STAGE_DEFINITIONS[stage].terminal,
);

const lookupLegacyStage = (map: Record<string, LeadStage>, key: string): LeadStage | undefined =>
  Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

export interface ParseLeadStageOptions {
  /** Aceita valores legados (TicketStage, LeadStatus, OpportunityStage). Padrão: `true`. */
  legacy?: boolean;
}

/**
 * Como `toLeadStage`, mas devolve `null` para valores desconhecidos — use para validar entrada de API.
 * Com `{ legacy: false }` aceita apenas os ids de `LEAD_STAGES` (ignorando maiúsculas/espaços).
 */
export const parseLeadStage = (value: unknown, options: ParseLeadStageOptions = {}): LeadStage | null => {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (isLeadStage(raw)) return raw;
  const lower = raw.toLowerCase();
  if (isLeadStage(lower)) return lower;
  if (options.legacy === false) return null;
  const upper = raw.toUpperCase();
  return (
    lookupLegacyStage(LEGACY_TICKET_STAGE_TO_LEAD_STAGE, lower) ??
    lookupLegacyStage(LEGACY_LEAD_STATUS_TO_LEAD_STAGE, upper) ??
    lookupLegacyStage(LEGACY_OPPORTUNITY_STAGE_TO_LEAD_STAGE, upper) ??
    null
  );
};

/** Normaliza qualquer valor conhecido (novo, legado do Inbox, do CRM ou de oportunidade) para `LeadStage`. */
export const toLeadStage = (value: unknown, fallback: LeadStage = DEFAULT_LEAD_STAGE): LeadStage =>
  parseLeadStage(value) ?? fallback;
