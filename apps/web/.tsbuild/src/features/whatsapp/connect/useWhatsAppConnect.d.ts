import { getStatusInfo } from '../lib/instances';
import { getInstanceMetrics } from '../lib/metrics';
type Nullable<T> = T | null;
export interface ErrorState {
    code: string | null;
    title: string | null;
    message: string;
}
export interface CampaignActionState {
    id: string | null;
    type: string | null;
}
export interface WhatsAppInstanceViewModel {
    key: string;
    id: string | null;
    displayName: string;
    phoneLabel: string;
    formattedPhone: string;
    addressLabel: string | null;
    statusInfo: ReturnType<typeof getStatusInfo>;
    metrics: ReturnType<typeof getInstanceMetrics>;
    statusValues: ReturnType<typeof getInstanceMetrics>['status'];
    rateUsage: ReturnType<typeof getInstanceMetrics>['rateUsage'];
    ratePercentage: number;
    lastUpdatedLabel: string;
    user: string | null;
    instance: any;
    isCurrent: boolean;
}
export interface WhatsAppConnectState {
    showAllInstances: boolean;
    qrPanelOpen: boolean;
    isQrDialogOpen: boolean;
    pairingPhoneInput: string;
    pairingPhoneError: string | null;
    requestingPairingCode: boolean;
    errorState: ErrorState | null;
    campaign: Nullable<any>;
    campaigns: any[];
    campaignsLoading: boolean;
    campaignError: string | null;
    campaignAction: CampaignActionState | null;
    instancePendingDelete: Nullable<any>;
    isCreateInstanceOpen: boolean;
    isCreateCampaignOpen: boolean;
    expandedInstanceId: string | null;
    pendingReassign: Nullable<any>;
    reassignIntent: 'reassign' | 'disconnect';
    persistentWarning: string | null;
}
export type WhatsAppConnectAction = {
    type: 'set-show-all-instances';
    value: boolean;
} | {
    type: 'set-qr-panel-open';
    value: boolean;
} | {
    type: 'set-qr-dialog-open';
    value: boolean;
} | {
    type: 'set-pairing-phone-input';
    value: string;
} | {
    type: 'set-pairing-phone-error';
    value: string | null;
} | {
    type: 'set-requesting-pairing';
    value: boolean;
} | {
    type: 'set-error-state';
    value: ErrorState | null;
} | {
    type: 'set-campaign';
    value: Nullable<any>;
} | {
    type: 'set-campaigns';
    value: any[];
} | {
    type: 'set-campaigns-loading';
    value: boolean;
} | {
    type: 'set-campaign-error';
    value: string | null;
} | {
    type: 'set-campaign-action';
    value: CampaignActionState | null;
} | {
    type: 'set-instance-pending-delete';
    value: Nullable<any>;
} | {
    type: 'set-create-instance-open';
    value: boolean;
} | {
    type: 'set-create-campaign-open';
    value: boolean;
} | {
    type: 'set-expanded-instance-id';
    value: string | null;
} | {
    type: 'set-pending-reassign';
    value: Nullable<any>;
} | {
    type: 'set-reassign-intent';
    value: 'reassign' | 'disconnect';
} | {
    type: 'set-persistent-warning';
    value: string | null;
};
declare const reducer: (state: WhatsAppConnectState, action: WhatsAppConnectAction) => WhatsAppConnectState;
export interface UseWhatsAppConnectParams {
    selectedAgreement: any;
    status?: string;
    activeCampaign?: any;
    onboarding?: any;
    onStatusChange?: (status: string) => void;
    onCampaignReady?: (campaign: any | null) => void;
    onBack?: () => void;
    onContinue?: () => void;
}
declare const useWhatsAppConnect: ({ selectedAgreement, status, activeCampaign, onboarding, onStatusChange, onCampaignReady, onBack, onContinue, }: UseWhatsAppConnectParams) => {
    state: WhatsAppConnectState;
    surfaceStyles: {
        instancesPanel: string;
        qrInstructionsPanel: string;
        glassTile: string;
        glassTileDashed: string;
        glassTileActive: string;
        glassTileIdle: string;
        destructiveBanner: string;
        qrIllustration: string;
        progressTrack: string;
        progressIndicator: string;
    };
    statusCopy: {
        readonly badge: "Pendente";
        readonly description: "Leia o QR Code no WhatsApp Web para conectar seu número e começar a receber leads.";
        readonly tone: "warning";
    } | {
        readonly badge: "Conectando";
        readonly description: "Estamos sincronizando com o seu número. Mantenha o WhatsApp aberto até concluir.";
        readonly tone: "info";
    } | {
        readonly badge: "Ativo";
        readonly description: "Pronto! Todos os leads qualificados serão entregues diretamente no seu WhatsApp.";
        readonly tone: "success";
    } | {
        readonly badge: "QR necessário";
        readonly description: "Gere um novo QR Code e escaneie para reativar a sessão.";
        readonly tone: "warning";
    };
    statusTone: "success" | "warning" | "info";
    countdownMessage: string | null;
    qrImageSrc: string | null;
    isGeneratingQrImage: boolean;
    qrStatusMessage: string;
    hasAgreement: boolean;
    agreementDisplayName: any;
    selectedAgreement: any;
    tenantFilterId: string | null;
    tenantFilterLabel: string | null;
    tenantFilteredOutCount: number;
    tenantScopeNotice: string | null;
    selectedInstanceBelongsToTenant: boolean;
    selectedInstance: import("../state/instancesStore.js").Nullable<import("../lib/instances").NormalizedInstance>;
    selectedInstancePhone: string;
    selectedInstanceStatusInfo: import("../lib/instances").InstanceStatusInfo | null;
    instancesReady: boolean;
    hasHiddenInstances: boolean;
    hasRenderableInstances: boolean;
    instanceViewModels: WhatsAppInstanceViewModel[];
    showFilterNotice: boolean;
    instancesCountLabel: string;
    loadingInstances: boolean;
    isAuthenticated: boolean;
    copy: {
        readonly badge: "Pendente";
        readonly description: "Leia o QR Code no WhatsApp Web para conectar seu número e começar a receber leads.";
        readonly tone: "warning";
    } | {
        readonly badge: "Conectando";
        readonly description: "Estamos sincronizando com o seu número. Mantenha o WhatsApp aberto até concluir.";
        readonly tone: "info";
    } | {
        readonly badge: "Ativo";
        readonly description: "Pronto! Todos os leads qualificados serão entregues diretamente no seu WhatsApp.";
        readonly tone: "success";
    } | {
        readonly badge: "QR necessário";
        readonly description: "Gere um novo QR Code e escaneie para reativar a sessão.";
        readonly tone: "warning";
    };
    connectionStatus: string;
    localStatus: string;
    onBack: (() => void) | undefined;
    handleRefreshInstances: () => void;
    handleCreateInstance: () => void;
    submitCreateInstance: ({ name, id }: {
        name: string;
        id?: string;
    }) => Promise<void>;
    createCampaign: ({ name, instanceId, agreementId, agreementName, leadSource, product, margin, strategy, status: requestedStatus, segments, }: {
        name: string;
        instanceId: string;
        agreementId: string;
        agreementName: string;
        leadSource: string;
        product: string;
        margin: number;
        strategy: string;
        segments?: string[];
        status?: string;
    }) => Promise<any>;
    updateCampaignStatus: (target: any, nextStatus: string) => Promise<void>;
    deleteCampaign: (target: any) => Promise<void>;
    reassignCampaign: (target: any, requestedInstanceId: string | null) => Promise<void>;
    campaigns: any[];
    campaignsLoading: boolean;
    campaignError: string | null;
    campaignAction: CampaignActionState | null;
    campaign: any;
    persistentWarning: string | null;
    canCreateInstance: boolean;
    createInstanceWarning: string | null;
    setShowAllInstances: (value: boolean) => void;
    renderInstances: import("../lib/instances").NormalizedInstance[];
    setQrPanelOpen: (value: boolean) => void;
    setQrDialogOpen: (value: boolean) => void;
    pairingPhoneInput: string;
    pairingPhoneError: string | null;
    requestingPairingCode: boolean;
    handlePairingPhoneChange: (event: any) => void;
    handleRequestPairingCode: () => Promise<void>;
    timelineItems: any[];
    realtimeConnected: boolean;
    connectionHealthy: boolean;
    handleInstanceSelect: (inst: any, { skipAutoQr }?: {
        skipAutoQr?: boolean | undefined;
    }) => Promise<void>;
    handleViewQr: (inst: any) => Promise<void>;
    handleGenerateQr: () => Promise<void>;
    handleMarkConnected: () => Promise<void>;
    handleDeleteInstance: (target: any) => Promise<void>;
    deletionDialog: {
        open: boolean;
        target: any;
        title: string;
        actionLabel: string;
        targetLabel: any;
    };
    setInstancePendingDelete: (value: any) => void;
    isBusy: boolean;
    canContinue: boolean;
    qrPanelOpen: boolean;
    isQrDialogOpen: boolean;
    hasCampaign: boolean;
    statusCodeMeta: {
        code: string;
        label: string;
        description: string;
    }[];
    defaultInstanceName: string;
    deletingInstanceId: import("../state/instancesStore.js").Nullable<string>;
    errorState: ErrorState | null;
    loadInstances: (loadOptions?: {}) => Promise<any>;
    reloadCampaigns: () => Promise<void>;
    showAllInstances: boolean;
    handleRetry: () => Promise<any>;
    setCreateInstanceOpen: (value: boolean) => void;
    setCreateCampaignOpen: (value: boolean) => void;
    isCreateInstanceOpen: boolean;
    isCreateCampaignOpen: boolean;
    setExpandedInstanceId: (value: string | null) => void;
    expandedInstanceId: string | null;
    setPendingReassign: (value: any) => void;
    pendingReassign: any;
    setReassignIntent: (value: "reassign" | "disconnect") => void;
    reassignIntent: "disconnect" | "reassign";
    fetchCampaignImpact: typeof import("./services/campaignService.js").fetchCampaignImpact;
    agreementName: any;
    nextStage: string;
    stepLabel: string;
    onboardingDescription: string;
    canCreateCampaigns: boolean;
    confirmLabel: string;
    confirmDisabled: boolean;
    onContinue: (() => void) | undefined;
};
export default useWhatsAppConnect;
export { reducer as whatsappConnectReducer };
