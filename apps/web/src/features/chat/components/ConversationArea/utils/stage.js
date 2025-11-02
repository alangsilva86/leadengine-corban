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
  DOCUMENTACAO: 'Documentação',
  DOCUMENTOS_AVERBACAO: 'Documentos/Averbação',
  AGUARDANDO: 'Aguardando',
  AGUARDANDO_CLIENTE: 'Aguardando Cliente',
  LIQUIDACAO: 'Liquidação',
  APROVADO_LIQUIDACAO: 'Aprovado/Liquidação',
  RECICLAR: 'Reciclar',
  DESCONHECIDO: 'Desconhecido',
};

const STAGE_PRESENTATION = {
  NOVO: { icon: Sparkles, tone: 'info' },
  CONECTADO: { icon: Link2, tone: 'info' },
  QUALIFICACAO: { icon: ClipboardList, tone: 'info' },
  PROPOSTA: { icon: FileText, tone: 'info' },
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
  DOCUMENTACAO: PRIMARY_ACTION_PRESETS.documentation,
  DOCUMENTOS_AVERBACAO: PRIMARY_ACTION_PRESETS.documentation,
  AGUARDANDO: PRIMARY_ACTION_PRESETS.followUp,
  AGUARDANDO_CLIENTE: PRIMARY_ACTION_PRESETS.followUp,
  LIQUIDACAO: PRIMARY_ACTION_PRESETS.closeDeal,
  APROVADO_LIQUIDACAO: PRIMARY_ACTION_PRESETS.closeDeal,
  RECICLAR: PRIMARY_ACTION_PRESETS.followUp,
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

  return canonical || 'DESCONHECIDO';
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

export {
  STAGE_LABELS,
  STAGE_PRESENTATION,
  PRIMARY_ACTION_PRESETS,
  PRIMARY_ACTION_MAP,
  normalizeStage,
  formatStageLabel,
  getTicketStage,
  getStageInfo,
  resolvePrimaryAction,
};
