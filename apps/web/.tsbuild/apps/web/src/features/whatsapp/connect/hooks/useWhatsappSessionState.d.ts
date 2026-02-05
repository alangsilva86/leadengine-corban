import type { WhatsAppConnectState } from '../useWhatsAppConnect';
declare const STATUS_TONES: {
    readonly disconnected: "warning";
    readonly connecting: "info";
    readonly connected: "success";
    readonly qr_required: "warning";
    readonly fallback: "neutral";
};
declare const STATUS_COPY: {
    readonly disconnected: {
        readonly badge: "Pendente";
        readonly description: "Leia o QR Code no WhatsApp Web para conectar seu número e começar a receber leads.";
        readonly tone: "warning";
    };
    readonly connecting: {
        readonly badge: "Conectando";
        readonly description: "Estamos sincronizando com o seu número. Mantenha o WhatsApp aberto até concluir.";
        readonly tone: "info";
    };
    readonly connected: {
        readonly badge: "Ativo";
        readonly description: "Pronto! Todos os leads qualificados serão entregues diretamente no seu WhatsApp.";
        readonly tone: "success";
    };
    readonly qr_required: {
        readonly badge: "QR necessário";
        readonly description: "Gere um novo QR Code e escaneie para reativar a sessão.";
        readonly tone: "warning";
    };
};
interface UseWhatsappSessionStateParams {
    state: WhatsAppConnectState;
    localStatus: string;
    qrData: any;
    secondsLeft: number | null;
    setSecondsLeft: (value: number | null) => void;
    setInstanceStatus: (status: string) => void;
    onStatusChange?: (status: string) => void;
    setGeneratingQrState: (value: boolean) => void;
    loadingInstances: boolean;
    loadingQr: boolean;
    requestingPairingCode: boolean;
    instance: any;
    realtimeConnected: boolean;
    selectInstance: (inst: any, options?: {
        skipAutoQr?: boolean;
    }) => Promise<void> | void;
    generateQr: (id: string) => Promise<void>;
    markConnected: () => Promise<boolean>;
    setQrPanelOpen: (value: boolean) => void;
    setQrDialogOpen: (value: boolean) => void;
}
declare const useWhatsappSessionState: ({ state, localStatus, qrData, secondsLeft, setSecondsLeft, setInstanceStatus, onStatusChange, setGeneratingQrState, loadingInstances, loadingQr, requestingPairingCode, instance, realtimeConnected, selectInstance, generateQr, markConnected, setQrPanelOpen, setQrDialogOpen, }: UseWhatsappSessionStateParams) => {
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
    isBusy: boolean;
    canContinue: boolean;
    qrPanelOpen: boolean;
    isQrDialogOpen: boolean;
    handleViewQr: (inst: any) => Promise<void>;
    handleGenerateQr: () => Promise<void>;
    handleMarkConnected: () => Promise<void>;
};
export default useWhatsappSessionState;
export { STATUS_TONES, STATUS_COPY };
