export const NAVIGATION_PAGES = {
    dashboard: { id: 'dashboard', label: 'Visão Geral', path: '/' },
    channels: { id: 'channels', label: 'Instâncias & Canais', path: '/channels' },
    campaigns: { id: 'campaigns', label: 'Campanhas', path: '/campaigns' },
    inbox: { id: 'inbox', label: 'Inbox', path: '/inbox' },
    contacts: { id: 'contacts', label: 'Contatos', path: '/contacts' },
    crm: { id: 'crm', label: 'CRM', path: '/crm' },
    'baileys-logs': { id: 'baileys-logs', label: 'Logs Baileys', path: '/baileys-logs' },
    settings: { id: 'settings', label: 'Configurações', path: '/settings' },
    whatsapp: { id: 'whatsapp', label: 'Conectar WhatsApp', path: '/channels' },
};
export const PRIMARY_NAVIGATION_IDS = [
    NAVIGATION_PAGES.dashboard.id,
    NAVIGATION_PAGES.channels.id,
    NAVIGATION_PAGES.campaigns.id,
    NAVIGATION_PAGES.inbox.id,
];
export const CONTEXTUAL_NAVIGATION_IDS = [
    NAVIGATION_PAGES.contacts.id,
    NAVIGATION_PAGES.crm.id,
    NAVIGATION_PAGES['baileys-logs'].id,
    NAVIGATION_PAGES.settings.id,
];
export const EXPOSED_NAVIGATION_PAGE_IDS = [
    NAVIGATION_PAGES.dashboard.id,
    NAVIGATION_PAGES.channels.id,
    NAVIGATION_PAGES.campaigns.id,
    NAVIGATION_PAGES.contacts.id,
    NAVIGATION_PAGES.crm.id,
];
