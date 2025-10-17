import { Clock3 } from 'lucide-react';

import { InboxSummaryGrid, statusMetrics } from './InboxSummaryGrid.jsx';

export default {
  title: 'Features/Leads/Inbox/InboxSummaryGrid',
  component: InboxSummaryGrid,
};

const Template = (args) => <InboxSummaryGrid {...args} />;

export const Default = Template.bind({});
Default.args = {
  summary: {
    total: 128,
    contacted: 54,
    won: 18,
    lost: 12,
  },
};

export const WithAdditionalStatus = Template.bind({});
WithAdditionalStatus.args = {
  summary: {
    total: 160,
    contacted: 72,
    won: 24,
    lost: 14,
    followUp: 32,
  },
  metrics: [
    ...statusMetrics,
    {
      key: 'followUp',
      label: 'Em acompanhamento',
      accent: 'text-sky-400',
      icon: <Clock3 className="h-4 w-4 text-sky-400" />,
    },
  ],
};
