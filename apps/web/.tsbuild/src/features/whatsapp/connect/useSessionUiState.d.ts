import type { WhatsAppConnectAction, WhatsAppConnectState } from './useWhatsAppConnect';
interface UseSessionUiStateParams {
    state: WhatsAppConnectState;
    dispatch: (action: WhatsAppConnectAction) => void;
    localStatus: string;
    qrData: any;
    secondsLeft: number | null;
    setSecondsLeft: (value: number | null) => void;
    setInstanceStatus: (status: string) => void;
    onStatusChange?: (status: string) => void;
    setGeneratingQrState: (value: boolean) => void;
    loadingInstances: boolean;
    loadingQr: boolean;
    instance: any;
    realtimeConnected: boolean;
    selectInstance: (inst: any, options?: {
        skipAutoQr?: boolean;
    }) => Promise<void> | void;
    generateQr: (id: string) => Promise<void>;
    markConnected: () => Promise<boolean>;
    connectInstance: (instanceId: string, options?: any) => Promise<any>;
    loadInstances: (options?: any) => Promise<any>;
    setErrorMessage: (message: string | null, meta?: Partial<{
        code: string | null;
        title: string | null;
    }>) => void;
    selectedAgreementId: string | undefined;
    requestingPairingCode: boolean;
}
declare const useSessionUiState: ({ state, dispatch, localStatus, qrData, secondsLeft, setSecondsLeft, setInstanceStatus, onStatusChange, setGeneratingQrState, loadingInstances, loadingQr, instance, realtimeConnected, selectInstance, generateQr, markConnected, connectInstance, loadInstances, setErrorMessage, selectedAgreementId, requestingPairingCode, }: UseSessionUiStateParams) => {
    pairingPhoneInput: string;
    pairingPhoneError: string | null;
    requestingPairingCode: boolean;
    handlePairingPhoneChange: (event: any) => void;
    handleRequestPairingCode: () => Promise<void>;
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
export default useSessionUiState;
