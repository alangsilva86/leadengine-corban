import type { Meta, StoryObj } from '@storybook/react';
import LeadCalendarView from '../views/LeadCalendarView';
import CrmStoryProviders from './CrmStoryProviders';

const meta: Meta<typeof LeadCalendarView> = {
  title: 'CRM/Views/Calendar',
  component: LeadCalendarView,
  decorators: [
    (Story) => (
      <CrmStoryProviders>
        <div className="max-w-5xl p-6">
          <Story />
        </div>
      </CrmStoryProviders>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LeadCalendarView>;

export const Default: Story = {};
