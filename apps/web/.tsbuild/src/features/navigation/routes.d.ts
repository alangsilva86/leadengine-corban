export type NavigationRouteDefinition = {
    id: string;
    label: string;
    path: string | null;
};
export declare const NAVIGATION_PAGES: {
    readonly dashboard: {
        readonly id: "dashboard";
        readonly label: "Visão Geral";
        readonly path: "/";
    };
    readonly channels: {
        readonly id: "channels";
        readonly label: "Instâncias & Canais";
        readonly path: "/channels";
    };
    readonly campaigns: {
        readonly id: "campaigns";
        readonly label: "Campanhas";
        readonly path: "/campaigns";
    };
    readonly inbox: {
        readonly id: "inbox";
        readonly label: "Inbox";
        readonly path: "/inbox";
    };
    readonly contacts: {
        readonly id: "contacts";
        readonly label: "Contatos";
        readonly path: "/contacts";
    };
    readonly crm: {
        readonly id: "crm";
        readonly label: "CRM";
        readonly path: "/crm";
    };
    readonly 'baileys-logs': {
        readonly id: "baileys-logs";
        readonly label: "Logs Baileys";
        readonly path: "/baileys-logs";
    };
    readonly settings: {
        readonly id: "settings";
        readonly label: "Configurações";
        readonly path: "/settings";
    };
    readonly whatsapp: {
        readonly id: "whatsapp";
        readonly label: "Conectar WhatsApp";
        readonly path: "/channels";
    };
};
export type NavigationPageId = (typeof NAVIGATION_PAGES)[keyof typeof NAVIGATION_PAGES]['id'];
export declare const PRIMARY_NAVIGATION_IDS: readonly ["dashboard", "channels", "campaigns", "inbox"];
export declare const CONTEXTUAL_NAVIGATION_IDS: readonly ["contacts", "crm", "baileys-logs", "settings"];
export declare const EXPOSED_NAVIGATION_PAGE_IDS: readonly ["dashboard", "channels", "campaigns", "contacts", "crm"];
