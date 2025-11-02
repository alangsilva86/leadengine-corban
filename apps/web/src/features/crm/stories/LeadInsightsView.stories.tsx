import type { Meta, StoryObj } from '@storybook/react';
import LeadInsightsView from '../views/LeadInsightsView';
import CrmStoryProviders from './CrmStoryProviders';

const meta: Meta<typeof LeadInsightsView> = {
  title: 'CRM/Views/Insights',
  component: LeadInsightsView,
  decorators: [
    (Story) => (
      <CrmStoryProviders>
        <div className="p-6">
          <Story />
        </div>
      </CrmStoryProviders>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LeadInsightsView>;

export const Default: Story = {};
