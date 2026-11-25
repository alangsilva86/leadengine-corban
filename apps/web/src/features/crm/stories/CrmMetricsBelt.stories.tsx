import type { Meta, StoryObj } from '@storybook/react';
import CrmMetricsBelt from '../components/CrmMetricsBelt';

const meta: Meta<typeof CrmMetricsBelt> = {
  title: 'CRM/Metrics Belt',
  component: CrmMetricsBelt,
  args: {
    metrics: [
      { id: 'activeLeads', label: 'Leads ativos', unit: 'count', value: 120, delta: 8, deltaUnit: 'count', trend: 'up' },
      { id: 'newLeads', label: 'Novos nos últimos 7 dias', unit: 'count', value: 14 },
      { id: 'stalledLeads', label: 'Sem atualização há 7 dias', unit: 'count', value: 3 },
    ],
    openValueLabel: 'R$ 58.400',
    source: 'api',
  },
};

export default meta;

type Story = StoryObj<typeof CrmMetricsBelt>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const FallbackData: Story = {
  args: {
    source: 'fallback',
  },
};
