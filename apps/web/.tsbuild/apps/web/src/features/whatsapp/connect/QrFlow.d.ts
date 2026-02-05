interface QrFlowProps {
    surfaceStyles: Record<string, string>;
    open: boolean;
    onOpenChange: (value: boolean) => void;
    qrImageSrc: string | null;
    isGeneratingQrImage: boolean;
    qrStatusMessage: string | null;
    onGenerate: () => void;
    onOpenQrDialog: () => void;
    generateDisabled: boolean;
    openDisabled: boolean;
    pairingPhoneInput: string;
    onPairingPhoneChange: (event: any) => void;
    pairingDisabled: boolean;
    requestingPairingCode: boolean;
    onRequestPairingCode: () => void;
    pairingPhoneError: string | null;
    timelineItems: any[];
    realtimeConnected: boolean;
}
declare const QrFlow: ({ surfaceStyles, open, onOpenChange, qrImageSrc, isGeneratingQrImage, qrStatusMessage, onGenerate, onOpenQrDialog, generateDisabled, openDisabled, pairingPhoneInput, onPairingPhoneChange, pairingDisabled, requestingPairingCode, onRequestPairingCode, pairingPhoneError, timelineItems, realtimeConnected, }: QrFlowProps) => import("react/jsx-runtime").JSX.Element;
export default QrFlow;
