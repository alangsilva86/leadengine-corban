import type { Meta, StoryObj } from '@storybook/react';
import CrmToolbar from '../components/CrmToolbar.tsx';
import type { CrmFilterState, CrmSavedView } from '../state/types.ts';

const sampleFilters: CrmFilterState = {
  stages: ['qualification'],
  owners: ['owner:me'],
  origins: ['web'],
  channels: ['whatsapp'],
  score: { min: 50, max: 90 },
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
    searchValue: 'Empresa XPTO',
    filters: sampleFilters,
    filterOptions: {
      stages: [
        { id: 'qualification', label: 'Qualificação' },
        { id: 'proposal', label: 'Proposta' },
      ],
      owners: [
        { id: 'owner:me', label: 'Meus leads' },
        { id: 'owner:team', label: 'Equipe' },
      ],
      origins: [
        { id: 'web', label: 'Formulário Web' },
        { id: 'ads', label: 'Campanhas Ads' },
      ],
      channels: [
        { id: 'whatsapp', label: 'WhatsApp' },
        { id: 'email', label: 'E-mail' },
      ],
    },
    onSearchChange: () => {},
    onFiltersChange: () => {},
    onClearFilters: () => {},
    selectedCount: 2,
    totalCount: 128,
    savedViews: savedViewsHandlers,
    onRefresh: () => {},
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

export const BulkDisabled: Story = {
  args: {
    selectedCount: 0,
  },
};
