import type { Meta, StoryObj } from '@storybook/react';
import { ChannelDistributionWidget } from './ChannelDistributionWidget';
import type { ChannelDistributionEntry } from '../useDashboardData';

const sampleData: ChannelDistributionEntry[] = [
  { name: 'WhatsApp', value: 55.2, color: 'var(--status-whatsapp)' },
  { name: 'Email', value: 21.4, color: 'var(--color-chart-1)' },
  { name: 'Telefone', value: 13.7, color: 'var(--color-chart-2)' },
  { name: 'Chat', value: 5.1, color: 'var(--color-chart-4)' },
  { name: 'Outros', value: 4.6, color: 'var(--muted)' },
];

const meta: Meta<typeof ChannelDistributionWidget> = {
  title: 'Dashboard/Widgets/ChannelDistributionWidget',
  component: ChannelDistributionWidget,
  args: {
    data: sampleData,
    loading: false,
  },
};

export default meta;

type Story = StoryObj<typeof ChannelDistributionWidget>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    data: [],
  },
};
