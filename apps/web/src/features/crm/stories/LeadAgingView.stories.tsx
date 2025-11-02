import type { Meta, StoryObj } from '@storybook/react';
import LeadAgingView from '../views/LeadAgingView.tsx';
import CrmStoryProviders from './CrmStoryProviders.tsx';

const meta: Meta<typeof LeadAgingView> = {
  title: 'CRM/Views/Aging',
  component: LeadAgingView,
  decorators: [
    (Story) => (
      <CrmStoryProviders>
        <div className="max-w-6xl p-6">
          <Story />
        </div>
      </CrmStoryProviders>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LeadAgingView>;

export const Default: Story = {};
