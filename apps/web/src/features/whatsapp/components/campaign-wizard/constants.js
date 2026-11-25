/** Etapas do assistente de regra (ordem = ordem na tela). */
export const STEP_SEQUENCE = [
  { key: 'instance', title: 'Número', description: 'Quem recebe os leads' },
  { key: 'agreement', title: 'Origem', description: 'De onde vêm os leads' },
  { key: 'product', title: 'Produto', description: 'Oferta e margem' },
  { key: 'strategy', title: 'Atendimento', description: 'Como o time aborda' },
  { key: 'review', title: 'Revisão', description: 'Confirme e crie' },
];

export const TOTAL_STEPS = STEP_SEQUENCE.length;

export const STEP_DEPENDENCIES = {
  agreement: ['instance'],
  product: ['agreement'],
  strategy: ['product'],
  review: ['strategy'],
};

export const STEP_BLOCKED_REASON = {
  agreement: 'Escolha um número conectado primeiro.',
  product: 'Informe a origem dos leads primeiro.',
  strategy: 'Escolha o produto e a margem primeiro.',
  review: 'Conclua as etapas anteriores.',
};

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativar agora' },
  { value: 'paused', label: 'Criar pausada' },
  { value: 'draft', label: 'Salvar como rascunho' },
];

export const LEAD_SOURCE_OPTIONS = [
  { value: 'inbound', label: 'O cliente chama', description: 'Leads que entram em contato pelo WhatsApp.' },
  { value: 'partner', label: 'Parceiro envia', description: 'Leads indicados por um parceiro ou convênio.' },
  { value: 'internal_list', label: 'Lista própria', description: 'Contatos da sua base que autorizaram contato.' },
];

export const LEAD_SOURCE_LABELS = LEAD_SOURCE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

export const PRODUCT_RULES = {
  consigned_credit: ['Até 35% da margem consignável', 'Sem seguro obrigatório'],
  benefit_card: ['Até 100% quando o convênio permitir', 'Sem seguro obrigatório'],
  salary_portability: ['Sem custo de portabilidade', 'Acompanhamento em D+1'],
};

/**
 * Estratégias de atendimento. Os valores são os mesmos enviados à API;
 * os nomes substituem os antigos rótulos HOT/WARM/COLD.
 * `proactive`: o time envia mensagens sem o cliente ter escrito antes → exige confirmação de consentimento.
 */
export const STRATEGY_CARDS = [
  {
    value: 'reactive_inbound',
    title: 'Resposta imediata',
    definition: 'Atende na hora quem chamou no WhatsApp.',
    cadence: 'Até 3 contatos em 48h',
    proactive: false,
  },
  {
    value: 'proactive_followup',
    title: 'Acompanhamento ativo',
    definition: 'Retoma o contato com quem já demonstrou interesse.',
    cadence: 'Até 2 contatos em 72h',
    proactive: true,
  },
  {
    value: 'hybrid',
    title: 'Nutrição gradual',
    definition: 'Contatos espaçados para leads que ainda estão decidindo.',
    cadence: '1 contato a cada 4 dias',
    proactive: true,
  },
];

export const findStrategyCard = (value) => STRATEGY_CARDS.find((card) => card.value === value) ?? null;

/** Código da origem gerado a partir do nome ("Prefeitura de Goiânia" → "prefeitura-de-goiania"). */
export const slugifyOrigin = (value) =>
  `${value ?? ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
