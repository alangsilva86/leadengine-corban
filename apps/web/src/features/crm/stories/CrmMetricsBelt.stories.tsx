import type { Meta, StoryObj } from '@storybook/react';
import CrmMetricsBelt from '../components/CrmMetricsBelt.tsx';

const meta: Meta<typeof CrmMetricsBelt> = {
  title: 'CRM/Metrics Belt',
  component: CrmMetricsBelt,
  args: {
    metrics: [
      { id: 'activeLeads', label: 'Leads ativos', unit: 'count', value: 120, delta: 8, deltaUnit: 'count', trend: 'up' },
      { id: 'slaCompliance', label: 'Dentro do SLA', unit: 'percentage', value: 84, delta: -3, deltaUnit: 'percentage', trend: 'down' },
      { id: 'avgResponseTime', label: '1ª resposta média', unit: 'duration', value: 54, delta: -6, deltaUnit: 'duration', trend: 'up' },
    ],
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
