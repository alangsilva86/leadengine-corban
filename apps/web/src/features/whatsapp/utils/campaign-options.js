export const WHATSAPP_CAMPAIGN_PRODUCTS = [
  {
    value: 'consigned_credit',
    label: 'Crédito consignado',
    description: 'Para convênios com consignação em folha e margem consignável.',
    defaultMargin: 1.8,
  },
  {
    value: 'benefit_card',
    label: 'Cartão benefício',
    description: 'Ideal para ofertas recorrentes com foco em ticket médio.',
    defaultMargin: 0.9,
  },
  {
    value: 'salary_portability',
    label: 'Portabilidade de salário',
    description: 'Campanhas focadas em retenção e portabilidade de folha.',
    defaultMargin: 1.2,
  },
];

export const WHATSAPP_CAMPAIGN_STRATEGIES = [
  {
    value: 'reactive_inbound',
    label: 'Inbound reativo',
    description: 'Distribui leads que chegam pelo WhatsApp para a equipe automática e rapidamente.',
  },
  {
    value: 'proactive_followup',
    label: 'Follow-up proativo',
    description: 'Programa mensagens ativas para acompanhar clientes com propostas em andamento.',
  },
  {
    value: 'hybrid',
    label: 'Híbrida',
    description: 'Combina inbound imediato com toques proativos conforme métricas de engajamento.',
  },
];

export const findCampaignProduct = (value) =>
  WHATSAPP_CAMPAIGN_PRODUCTS.find((option) => option.value === value) ?? null;

export const findCampaignStrategy = (value) =>
  WHATSAPP_CAMPAIGN_STRATEGIES.find((option) => option.value === value) ?? null;
