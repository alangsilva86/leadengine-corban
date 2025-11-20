import type { StoredOnboardingPage } from '@/features/onboarding/useOnboardingState.ts';

export type NavigationRouteDefinition = {
  id: string;
  label: string;
  path: string | null;
};

export const NAVIGATION_PAGES = {
  dashboard: { id: 'dashboard', label: 'Visão Geral', path: '/' },
  channels: { id: 'channels', label: 'Instâncias & Canais', path: '/channels' },
  campaigns: { id: 'campaigns', label: 'Campanhas', path: '/campaigns' },
  inbox: { id: 'inbox', label: 'Inbox', path: null },
  contacts: { id: 'contacts', label: 'Contatos', path: '/contacts' },
  crm: { id: 'crm', label: 'CRM', path: '/crm' },
  agreements: { id: 'agreements', label: 'Convênios', path: null },
  reports: { id: 'reports', label: 'Relatórios', path: null },
  'baileys-logs': { id: 'baileys-logs', label: 'Logs Baileys', path: null },
  settings: { id: 'settings', label: 'Configurações', path: null },
  'tenant-admin': { id: 'tenant-admin', label: 'Tenant Admin', path: '/admin/tenants' },
  whatsapp: { id: 'whatsapp', label: 'Conectar WhatsApp', path: null },
  'accept-invite': { id: 'accept-invite', label: 'Validar convite', path: '/onboarding' },
  team: { id: 'team', label: 'Equipe & Operador', path: '/onboarding' },
  complete: { id: 'complete', label: 'Concluir', path: '/onboarding' },
} as const satisfies Record<string, NavigationRouteDefinition>;

export type NavigationPageId =
  (typeof NAVIGATION_PAGES)[keyof typeof NAVIGATION_PAGES]['id'];

export const PRIMARY_NAVIGATION_IDS = [
  NAVIGATION_PAGES.dashboard.id,
  NAVIGATION_PAGES.channels.id,
  NAVIGATION_PAGES.campaigns.id,
  NAVIGATION_PAGES.inbox.id,
] as const satisfies readonly NavigationPageId[];

export const CONTEXTUAL_NAVIGATION_IDS = [
  NAVIGATION_PAGES.contacts.id,
  NAVIGATION_PAGES.crm.id,
  NAVIGATION_PAGES.agreements.id,
  NAVIGATION_PAGES.reports.id,
  NAVIGATION_PAGES['baileys-logs'].id,
  NAVIGATION_PAGES.settings.id,
  NAVIGATION_PAGES['tenant-admin'].id,
] as const satisfies readonly NavigationPageId[];

export const ONBOARDING_PAGE_IDS = [
  NAVIGATION_PAGES.dashboard.id,
  NAVIGATION_PAGES.channels.id,
  NAVIGATION_PAGES.campaigns.id,
  NAVIGATION_PAGES.agreements.id,
  NAVIGATION_PAGES.inbox.id,
  NAVIGATION_PAGES.reports.id,
  NAVIGATION_PAGES.settings.id,
  NAVIGATION_PAGES['baileys-logs'].id,
  NAVIGATION_PAGES.whatsapp.id,
  NAVIGATION_PAGES['accept-invite'].id,
  NAVIGATION_PAGES.team.id,
  NAVIGATION_PAGES.complete.id,
] as const satisfies readonly StoredOnboardingPage[];

export const EXPOSED_NAVIGATION_PAGE_IDS = [
  NAVIGATION_PAGES.dashboard.id,
  NAVIGATION_PAGES.channels.id,
  NAVIGATION_PAGES.campaigns.id,
  NAVIGATION_PAGES.contacts.id,
  NAVIGATION_PAGES.crm.id,
] as const satisfies readonly NavigationPageId[];
