import {
  BadgeCheck,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileSignature,
  FileText,
  HelpCircle,
  Hourglass,
  Link2,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';

const STAGE_LABELS = {
  NOVO: 'Novo',
  CONECTADO: 'Conectado',
  QUALIFICACAO: 'Qualificação',
  PROPOSTA: 'Proposta',
  SIMULADO: 'Simulado',
  PROPOSTA_ENVIADA: 'Proposta enviada',
  ACEITO: 'Aceito',
  DIGITANDO: 'Digitando',
  CONCLUIDO: 'Concluído',
  DOCUMENTACAO: 'Documentação',
  DOCUMENTOS_AVERBACAO: 'Documentos/Averbação',
  AGUARDANDO: 'Aguardando',
  AGUARDANDO_CLIENTE: 'Aguardando Cliente',
  LIQUIDACAO: 'Liquidação',
  APROVADO_LIQUIDACAO: 'Aprovado/Liquidação',
  RECICLAR: 'Reciclar',
  DESCONHECIDO: 'Desconhecido',
};

const STAGE_ALIAS_MAP = {
  QUALIFICANDO: 'QUALIFICACAO',
  QUALIFICACAO_INICIAL: 'QUALIFICACAO',
  QUALIFICANDO_LEAD: 'QUALIFICACAO',
  QUALIFICACAO_AVANCADA: 'QUALIFICACAO',
  SIMULACAO: 'SIMULADO',
  SIMULANDO: 'SIMULADO',
  SIMULACAO_CONCLUIDA: 'SIMULADO',
  PROPOSTA_ENVIADO: 'PROPOSTA_ENVIADA',
  PROPOSTA_APROVADA: 'ACEITO',
  ACEITE: 'ACEITO',
  ACEITA: 'ACEITO',
  DIGITACAO: 'DIGITANDO',
  DIGITACAO_CONTRATO: 'DIGITANDO',
  DIGITACAO_CONCLUIDA: 'CONCLUIDO',
  CONCLUSAO: 'CONCLUIDO',
  CONCLUIDA: 'CONCLUIDO',
  DOCUMENTANDO: 'DOCUMENTACAO',
  DOCUMENTOS: 'DOCUMENTACAO',
  DOCUMENTACAO_COMPLETA: 'DOCUMENTACAO',
  DOCUMENTOS_RECEBIDOS: 'DOCUMENTACAO',
  AVERBACAO: 'DOCUMENTOS_AVERBACAO',
  AVERBANDO: 'DOCUMENTOS_AVERBACAO',
  AVERBACAO_PENDENTE: 'DOCUMENTOS_AVERBACAO',
  LIQUIDANDO: 'LIQUIDACAO',
  LIQUIDACAO_EM_ANDAMENTO: 'LIQUIDACAO',
  LIQUIDACAO_APROVADA: 'APROVADO_LIQUIDACAO',
  APROVADO: 'APROVADO_LIQUIDACAO',
  GANHO: 'APROVADO_LIQUIDACAO',
  VENCIDO: 'RECICLAR',
  RECICLANDO: 'RECICLAR',
  RECICLAGEM: 'RECICLAR',
  ENGAJADO: 'CONECTADO',
  CONECTANDO: 'CONECTADO',
  CONEXAO: 'CONECTADO',
  AGUARDANDO_ANALISE: 'AGUARDANDO',
  ANALISE_INTERNA: 'AGUARDANDO',
  AGUARDANDO_DOCUMENTOS: 'AGUARDANDO_CLIENTE',
  AGUARDANDO_ASSINATURA: 'AGUARDANDO_CLIENTE',
  INDEFINIDO: 'DESCONHECIDO',
  UNKNOWN: 'DESCONHECIDO',
};

const STAGE_VALUE_MAP = {
  NOVO: 'novo',
  CONECTADO: 'conectado',
  QUALIFICACAO: 'qualificando',
  PROPOSTA: 'proposta',
  SIMULADO: 'simulado',
  PROPOSTA_ENVIADA: 'proposta_enviada',
  ACEITO: 'aceito',
  DIGITANDO: 'digitando',
  CONCLUIDO: 'concluido',
  DOCUMENTACAO: 'documentando',
  DOCUMENTOS_AVERBACAO: 'averbando',
  AGUARDANDO: 'aguardando',
  AGUARDANDO_CLIENTE: 'aguardando_cliente',
  LIQUIDACAO: 'liquidando',
  APROVADO_LIQUIDACAO: 'ganho',
  RECICLAR: 'reciclando',
  DESCONHECIDO: 'desconhecido',
};

const LEGACY_STAGE_VALUE_MAP = {
  NOVO: 'novo',
  CONECTADO: 'conectado',
  QUALIFICACAO: 'qualificacao',
  PROPOSTA: 'proposta',
  SIMULADO: 'simulado',
  PROPOSTA_ENVIADA: 'proposta_enviada',
  ACEITO: 'aceito',
  DIGITANDO: 'digitando',
  CONCLUIDO: 'concluido',
  DOCUMENTACAO: 'documentacao',
  DOCUMENTOS_AVERBACAO: 'documentos_averbacao',
  AGUARDANDO: 'aguardando',
  AGUARDANDO_CLIENTE: 'aguardando_cliente',
  LIQUIDACAO: 'liquidacao',
  APROVADO_LIQUIDACAO: 'aprovado_liquidacao',
  RECICLAR: 'reciclar',
  DESCONHECIDO: 'desconhecido',
};

const STAGE_PRESENTATION = {
  NOVO: { icon: Sparkles, tone: 'info' },
  CONECTADO: { icon: Link2, tone: 'info' },
  QUALIFICACAO: { icon: ClipboardList, tone: 'info' },
  PROPOSTA: { icon: FileText, tone: 'info' },
  SIMULADO: { icon: ClipboardList, tone: 'info' },
  PROPOSTA_ENVIADA: { icon: FileText, tone: 'info' },
  ACEITO: { icon: FileCheck2, tone: 'success' },
  DIGITANDO: { icon: FileSignature, tone: 'info' },
  CONCLUIDO: { icon: BadgeCheck, tone: 'success' },
  DOCUMENTACAO: { icon: FileSignature, tone: 'info' },
  DOCUMENTOS_AVERBACAO: { icon: FileCheck2, tone: 'info' },
  AGUARDANDO: { icon: Hourglass, tone: 'warning' },
  AGUARDANDO_CLIENTE: { icon: Clock3, tone: 'warning' },
  LIQUIDACAO: { icon: CircleDollarSign, tone: 'success' },
  APROVADO_LIQUIDACAO: { icon: BadgeCheck, tone: 'success' },
  RECICLAR: { icon: RefreshCcw, tone: 'neutral' },
  DESCONHECIDO: { icon: HelpCircle, tone: 'neutral' },
};

const PRIMARY_ACTION_PRESETS = {
  initialContact: {
    whatsapp: { id: 'send-initial-wa', label: 'Enviar 1ª mensagem (WhatsApp)' },
    validateContact: { id: 'validate-contact', label: 'Validar contato' },
    fallback: { id: 'call-now', label: 'Ligar agora' },
  },
  keepEngagement: {
    whatsapp: { id: 'send-wa', label: 'Enviar mensagem (WhatsApp)' },
    validateContact: { id: 'validate-contact', label: 'Validar contato' },
    fallback: { id: 'call-now', label: 'Ligar agora' },
  },
  qualify: {
    default: { id: 'qualify', label: 'Registrar próximo passo' },
  },
  proposal: {
    default: { id: 'generate-proposal', label: 'Gerar proposta' },
  },
  documentation: {
    default: { id: 'send-steps', label: 'Enviar passo a passo' },
  },
  followUp: {
    whatsapp: { id: 'send-followup', label: 'Enviar follow-up' },
    fallback: { id: 'call-followup', label: 'Ligar (follow-up)' },
  },
  closeDeal: {
    default: { id: 'close-register', label: 'Registrar resultado' },
  },
};

const PRIMARY_ACTION_MAP = {
  NOVO: PRIMARY_ACTION_PRESETS.initialContact,
  CONECTADO: PRIMARY_ACTION_PRESETS.keepEngagement,
  QUALIFICACAO: PRIMARY_ACTION_PRESETS.qualify,
  PROPOSTA: PRIMARY_ACTION_PRESETS.proposal,
  SIMULADO: PRIMARY_ACTION_PRESETS.proposal,
  PROPOSTA_ENVIADA: PRIMARY_ACTION_PRESETS.closeDeal,
  ACEITO: PRIMARY_ACTION_PRESETS.closeDeal,
  DIGITANDO: PRIMARY_ACTION_PRESETS.closeDeal,
  CONCLUIDO: PRIMARY_ACTION_PRESETS.closeDeal,
  DOCUMENTACAO: PRIMARY_ACTION_PRESETS.documentation,
  DOCUMENTOS_AVERBACAO: PRIMARY_ACTION_PRESETS.documentation,
  AGUARDANDO: PRIMARY_ACTION_PRESETS.followUp,
  AGUARDANDO_CLIENTE: PRIMARY_ACTION_PRESETS.followUp,
  LIQUIDACAO: PRIMARY_ACTION_PRESETS.closeDeal,
  APROVADO_LIQUIDACAO: PRIMARY_ACTION_PRESETS.closeDeal,
  RECICLAR: PRIMARY_ACTION_PRESETS.followUp,
};

const STAGE_SALES_HINTS = {
  SIMULADO: { hasSimulation: true },
  PROPOSTA_ENVIADA: { hasSimulation: true, hasProposal: true },
  ACEITO: { hasSimulation: true, hasProposal: true },
  DIGITANDO: { hasSimulation: true, hasProposal: true },
  CONCLUIDO: { hasSimulation: true, hasProposal: true, hasDeal: true },
};

const SALES_STAGE_ORDER = {
  SIMULADO: 1,
  PROPOSTA_ENVIADA: 2,
  ACEITO: 3,
  DIGITANDO: 4,
  CONCLUIDO: 5,
};

const resolveStageKey = (canonical) => {
  if (!canonical) {
    return 'DESCONHECIDO';
  }

  if (STAGE_LABELS[canonical]) {
    return canonical;
  }

  if (STAGE_ALIAS_MAP[canonical]) {
    return STAGE_ALIAS_MAP[canonical];
  }

  if (canonical.startsWith('QUALIFIC')) {
    return 'QUALIFICACAO';
  }

  if (canonical.startsWith('DOCUMENTO')) {
    return canonical.includes('AVERBAC') ? 'DOCUMENTOS_AVERBACAO' : 'DOCUMENTACAO';
  }

  if (canonical.startsWith('AVERB')) {
    return 'DOCUMENTOS_AVERBACAO';
  }

  if (canonical.startsWith('AGUARDANDO_CLIENTE')) {
    return 'AGUARDANDO_CLIENTE';
  }

  if (canonical.startsWith('AGUARDANDO')) {
    return 'AGUARDANDO';
  }

  if (canonical.startsWith('LIQUIDA')) {
    return 'LIQUIDACAO';
  }

  if (canonical.startsWith('APROV')) {
    return 'APROVADO_LIQUIDACAO';
  }

  if (canonical.startsWith('RECIC')) {
    return 'RECICLAR';
  }

  if (canonical.startsWith('CONECT') || canonical.startsWith('ENGAJ')) {
    return 'CONECTADO';
  }

  return canonical;
};

const normalizeStage = (value) => {
  if (!value) return 'DESCONHECIDO';
  const canonical = value
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  const resolved = resolveStageKey(canonical);

  if (STAGE_LABELS[resolved] || resolved === 'DESCONHECIDO') {
    return resolved;
  }

  return canonical && STAGE_LABELS[canonical] ? canonical : 'DESCONHECIDO';
};

const formatFallbackStageLabel = (stageKey) =>
  stageKey
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(' ');

const formatStageLabel = (stageKey) => {
  const normalized = normalizeStage(stageKey);
  if (STAGE_LABELS[normalized]) {
    return STAGE_LABELS[normalized];
  }

  if (normalized === 'DESCONHECIDO') {
    return STAGE_LABELS.DESCONHECIDO;
  }

  return formatFallbackStageLabel(normalized);
};

const getTicketStage = (ticket) => {
  const stage =
    ticket?.pipelineStep ??
    ticket?.metadata?.pipelineStep ??
    ticket?.stage ??
    null;
  return normalizeStage(stage);
};

const getStageInfo = (stageKey) => {
  if (!stageKey) {
    return null;
  }

  const normalized = normalizeStage(stageKey);
  const label = formatStageLabel(normalized);
  const presentation = STAGE_PRESENTATION[normalized] ?? STAGE_PRESENTATION.DESCONHECIDO;

  return {
    label,
    tone: presentation.tone ?? 'neutral',
    icon: presentation.icon ?? HelpCircle,
  };
};

const resolvePrimaryAction = ({ stageKey, hasWhatsApp, needsContactValidation = false }) => {
  const preset = PRIMARY_ACTION_MAP[stageKey] ?? PRIMARY_ACTION_MAP[`${stageKey}_`];
  if (!preset) {
    return null;
  }

  if (preset.whatsapp && hasWhatsApp) {
    return preset.whatsapp;
  }

  if (preset.validateContact && needsContactValidation) {
    return preset.validateContact;
  }

  return preset.default ?? preset.fallback ?? null;
};

const getStageSalesHints = (stageKey) => {
  const normalized = normalizeStage(stageKey);
  return STAGE_SALES_HINTS[normalized] ?? null;
};

const applyStageSalesHints = (stageKey, state = {}) => {
  const hints = getStageSalesHints(stageKey);
  const result = {
    hasSimulation: Boolean(state?.hasSimulation),
    hasProposal: Boolean(state?.hasProposal),
    hasDeal: Boolean(state?.hasDeal),
  };

  if (hints) {
    if (hints.hasSimulation) {
      result.hasSimulation = true;
    }
    if (hints.hasProposal) {
      result.hasProposal = true;
    }
    if (hints.hasDeal) {
      result.hasDeal = true;
    }
  }

  if (result.hasDeal) {
    result.hasProposal = true;
    result.hasSimulation = true;
  } else if (result.hasProposal) {
    result.hasSimulation = true;
  }

  return result;
};

const getSalesStageOrder = (stageKey) => {
  const normalized = normalizeStage(stageKey);
  return typeof SALES_STAGE_ORDER[normalized] === 'number' ? SALES_STAGE_ORDER[normalized] : null;
};

export {
  STAGE_LABELS,
  STAGE_PRESENTATION,
  STAGE_VALUE_MAP,
  PRIMARY_ACTION_PRESETS,
  PRIMARY_ACTION_MAP,
  STAGE_SALES_HINTS,
  SALES_STAGE_ORDER,
  normalizeStage,
  formatStageLabel,
  getTicketStage,
  getStageInfo,
  resolvePrimaryAction,
  getStageSalesHints,
  applyStageSalesHints,
  getSalesStageOrder,
};

export const getStageValue = (stageKey, { legacy = false } = {}) => {
  const normalized = normalizeStage(stageKey);
  const map = legacy ? LEGACY_STAGE_VALUE_MAP : STAGE_VALUE_MAP;
  return map[normalized] ?? normalized.toLowerCase();
};

export const getLegacyStageValue = (stageKey) => getStageValue(stageKey, { legacy: true });
