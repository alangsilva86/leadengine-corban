import type { Meta, StoryObj } from '@storybook/react';
import CrmToolbar from '../components/CrmToolbar';
import type { CrmFilterState, CrmSavedView } from '../state/types';

const sampleFilters: CrmFilterState = {
  search: 'Empresa XPTO',
  stages: ['qualificacao'],
  owners: ['owner:me'],
  origins: ['whatsapp'],
  inactivityDays: 3,
};

const savedViewsHandlers = {
  views: [
    {
      id: 'view-1',
      name: 'Leads quentes',
      scope: 'personal' as CrmSavedView['scope'],
      filters: sampleFilters,
      description: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  activeViewId: 'view-1',
  isSaving: false,
  isDeleting: false,
  createSavedView: async () => {},
  updateSavedView: async () => {},
  deleteSavedView: async () => {},
  selectSavedView: async () => {},
};

const meta: Meta<typeof CrmToolbar> = {
  title: 'CRM/Toolbar',
  component: CrmToolbar,
  args: {
    filters: sampleFilters,
    filterOptions: {
      stages: [
        { id: 'qualificacao', label: 'Qualificação' },
        { id: 'proposta', label: 'Proposta' },
      ],
      owners: [{ id: 'owner:me', label: 'Meus leads' }],
      origins: [
        { id: 'whatsapp', label: 'WhatsApp' },
        { id: 'website', label: 'Site' },
        { id: 'referral', label: 'Indicação' },
      ],
    },
    onFiltersChange: () => {},
    onClearFilters: () => {},
    savedViews: savedViewsHandlers,
  },
};

export default meta;

type Story = StoryObj<typeof CrmToolbar>;

export const Default: Story = {};

export const LoadingSavedViews: Story = {
  args: {
    savedViews: {
      ...savedViewsHandlers,
      isSaving: true,
    },
  },
};

export const NoFilters: Story = {
  args: {
    filters: { stages: [], owners: [], origins: [], channels: [], score: null, dateRange: null, inactivityDays: null },
  },
};
