import type { Meta, StoryObj } from '@storybook/react';
import { TicketsDailyWidget } from './TicketsDailyWidget.tsx';
import type { TicketSeriesEntry } from '../useDashboardData.ts';

const sampleData: TicketSeriesEntry[] = [
  { name: 'Seg', abertos: 12, pendentes: 6, fechados: 8 },
  { name: 'Ter', abertos: 9, pendentes: 4, fechados: 10 },
  { name: 'Qua', abertos: 14, pendentes: 7, fechados: 12 },
  { name: 'Qui', abertos: 11, pendentes: 5, fechados: 9 },
  { name: 'Sex', abertos: 8, pendentes: 3, fechados: 7 },
];

const meta: Meta<typeof TicketsDailyWidget> = {
  title: 'Dashboard/Widgets/TicketsDailyWidget',
  component: TicketsDailyWidget,
  args: {
    data: sampleData,
    loading: false,
  },
};

export default meta;

type Story = StoryObj<typeof TicketsDailyWidget>;

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
