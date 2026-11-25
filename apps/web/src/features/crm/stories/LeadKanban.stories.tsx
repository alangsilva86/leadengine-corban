import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { DragDropContext } from '@hello-pangea/dnd';
import StageColumn from '../components/kanban/StageColumn';
import type { LeadSummary } from '../state/leads';

const sampleLeads: LeadSummary[] = [
  {
    id: 'lead-1',
    name: 'Clínica Aurora',
    stage: 'qualificacao',
    ownerId: 'owner:me',
    ownerName: 'Você',
    lastActivityAt: new Date().toISOString(),
    source: 'whatsapp',
    channel: 'whatsapp',
    potentialValue: 12000,
    status: 'in_progress',
  },
  {
    id: 'lead-2',
    name: 'Farmácia Centro',
    stage: 'qualificacao',
    ownerId: 'owner:team',
    ownerName: 'Equipe Norte',
    lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    source: 'paid_ads',
    channel: null,
    potentialValue: 8000,
    status: 'in_progress',
  },
];

const meta: Meta<typeof StageColumn> = {
  title: 'CRM/Kanban Stage Column',
  component: StageColumn,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <DragDropContext onDragEnd={() => {}}>
          <Story />
        </DragDropContext>
      </MemoryRouter>
    ),
  ],
  args: {
    stage: {
      id: 'qualificacao',
      title: 'Qualificação',
      description: 'Consulta de margem, convênio e elegibilidade.',
      tone: 'info',
      exit: false,
    },
    leads: sampleLeads,
    metrics: { totalPotential: 20000, stalledCount: 1 },
    onOpenLead: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof StageColumn>;

export const Default: Story = {};

/** Durante o arraste de um lead perdido: a coluna recusa a soltura e explica o motivo. */
export const Blocked: Story = {
  args: { dropState: 'blocked', blockedReason: 'Só pode ir para Reciclar' },
};

export const Empty: Story = {
  args: {
    leads: [],
    metrics: { totalPotential: 0, stalledCount: 0 },
  },
};
