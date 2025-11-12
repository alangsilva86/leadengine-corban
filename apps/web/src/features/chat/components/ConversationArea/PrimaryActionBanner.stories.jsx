import { CheckCircle2, ClipboardCheck, Headset } from 'lucide-react';
import PrimaryActionBanner from './PrimaryActionBanner.jsx';

const ticket = {
  id: 'ticket-1',
  instanceId: 'inst-01',
  subject: 'João Silva',
  contact: {
    id: 'contact-1',
    name: 'João Silva',
    phone: '+55 11 90000-1111',
    document: '123.456.789-00',
    email: 'joao.silva@example.com',
  },
  lead: {
    id: 'lead-1',
    campaignId: 'camp-001',
    campaignName: 'Campanha Cartão Benefício',
    customFields: {
      deal: {
        installmentValue: '450.00',
        netValue: '12000.00',
      },
    },
  },
  metadata: {
    sourceInstance: 'inst-01',
    campaignId: 'camp-001',
    campaignName: 'Campanha Cartão Benefício',
    productType: 'Convênio Premium',
    strategy: 'Follow-up ativo',
    contactPhone: '+55 11 98888-1234',
  },
};

const meta = {
  title: 'Features/Chat/Conversation Header/PrimaryActionBanner',
  component: PrimaryActionBanner,
  parameters: {
    layout: 'padded',
  },
  args: {
    name: 'João Silva',
    title: 'João Silva | Ticketz Bank',
    shortId: 'LEAD-1234',
    statusInfo: {
      label: 'Ativo',
      tone: 'success',
      icon: CheckCircle2,
    },
    stageKey: 'Negociação',
    stageInfo: {
      label: 'Negociação',
      tone: 'info',
      icon: ClipboardCheck,
    },
    originInfo: {
      label: 'WhatsApp',
      icon: Headset,
    },
    typingAgents: [
      { userId: 'agent-1', userName: 'Fernanda Ribeiro' },
      { userId: 'agent-2', userName: 'Carlos Nogueira' },
    ],
    primaryAction: {
      label: 'Registrar contato',
    },
    onPrimaryAction: () => {},
    jro: {
      state: 'neutral',
      progress: 0.4,
      deadline: new Date().toISOString(),
      remainingLabel: '02:15:00',
      msRemaining: 8100000,
    },
    commandContext: {},
    detailsOpen: false,
    onRequestDetails: () => {},
    nextStepValue: 'Retornar amanhã',
    ticket,
    aiMode: 'assist',
    aiConfidence: 0.82,
    aiModeChangeDisabled: false,
    onAiModeChange: () => {},
    onTakeOver: () => {},
    onGiveBackToAi: () => {},
    contactPhone: '+55 11 98888-1234',
    instanceId: 'inst-01',
    instancePresentation: {
      label: 'Instância São Paulo',
      color: '#2563eb',
      number: '+55 11 98888-1234',
    },
  },
  render: (args) => (
    <div className="bg-slate-900 p-6">
      <div className="mx-auto max-w-4xl">
        <PrimaryActionBanner {...args} />
      </div>
    </div>
  ),
};

export default meta;

export const Default = {
  args: {},
};
