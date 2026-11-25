export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT';

export type NavigationRouteDefinition = {
  id: string;
  label: string;
  path: string | null;
  /** Texto curto exibido no cabeçalho e no título da aba. */
  title?: string;
  /** Papéis que enxergam a página. Ausente = todos. */
  roles?: readonly UserRole[];
};

/**
 * Fonte única das páginas do app. URLs antigas continuam funcionando (ver redirects em App.jsx).
 * Glossário: "Inbox" = conversas de WhatsApp; "Canais" = números conectados; "Empresa" = organização.
 */
export const NAVIGATION_PAGES = {
  inbox: { id: 'inbox', label: 'Inbox', title: 'Inbox', path: '/inbox' },
  contacts: { id: 'contacts', label: 'Contatos', title: 'Contatos', path: '/contacts' },
  crm: { id: 'crm', label: 'CRM', title: 'CRM', path: '/crm' },
  dashboard: { id: 'dashboard', label: 'Visão geral', title: 'Visão geral', path: '/' },
  // Antigas "Campanhas": regras que levam os leads de uma origem (convênio/parceiro) ao número certo.
  campaigns: {
    id: 'campaigns',
    label: 'Regras de roteamento',
    title: 'Regras de roteamento',
    path: '/routing-rules',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  channels: {
    id: 'channels',
    label: 'Canais',
    title: 'Canais',
    path: '/channels',
    roles: ['ADMIN', 'SUPERVISOR'],
  },
  settings: { id: 'settings', label: 'Configurações', title: 'Configurações', path: '/settings' },
  // Ferramenta de suporte: fica dentro de Configurações, só para administradores.
  'baileys-logs': {
    id: 'baileys-logs',
    label: 'Diagnóstico',
    title: 'Diagnóstico',
    path: '/settings/diagnostics',
    roles: ['ADMIN'],
  },
  whatsapp: { id: 'whatsapp', label: 'Conectar WhatsApp', title: 'Canais', path: '/channels' },
} as const satisfies Record<string, NavigationRouteDefinition>;

export type NavigationPageId = (typeof NAVIGATION_PAGES)[keyof typeof NAVIGATION_PAGES]['id'];

export type NavigationSection = {
  id: string;
  /** Rótulo do grupo; ausente no grupo principal. */
  label?: string;
  items: readonly NavigationPageId[];
};

/** Ordem por frequência de uso: atendimento primeiro, gestão depois, configuração por último. */
const NAVIGATION_SECTIONS: readonly NavigationSection[] = [
  { id: 'work', items: ['inbox', 'contacts', 'crm', 'dashboard'] },
  { id: 'manage', label: 'Gestão', items: ['campaigns'] },
  { id: 'configure', label: 'Configurar', items: ['channels', 'settings'] },
];

export const canAccessPage = (pageId: NavigationPageId, role?: string | null) => {
  const definition = NAVIGATION_PAGES[pageId as keyof typeof NAVIGATION_PAGES] as NavigationRouteDefinition | undefined;
  if (!definition) return false;
  if (!definition.roles) return true;
  return Boolean(role && (definition.roles as readonly string[]).includes(role));
};

export const getNavigationSections = (role?: string | null) =>
  NAVIGATION_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((id) => canAccessPage(id, role)),
  })).filter((section) => section.items.length > 0);

/** Página inicial por papel: quem atende cai direto no Inbox. */
export const getHomePath = (role?: string | null) => (role === 'AGENT' ? NAVIGATION_PAGES.inbox.path : NAVIGATION_PAGES.dashboard.path);

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  AGENT: 'Atendente',
};

// Compatibilidade com consumidores antigos.
export const PRIMARY_NAVIGATION_IDS = NAVIGATION_SECTIONS[0]?.items ?? [];
export const CONTEXTUAL_NAVIGATION_IDS = NAVIGATION_SECTIONS.slice(1).flatMap((section) => section.items);
export const EXPOSED_NAVIGATION_PAGE_IDS = NAVIGATION_SECTIONS.flatMap((section) => section.items);
