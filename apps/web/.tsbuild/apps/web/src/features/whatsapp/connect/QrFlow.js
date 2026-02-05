import { jsx as _jsx } from "react/jsx-runtime";
import { Suspense } from 'react';
import QrSection from '../components/QrSection.jsx';
const FallbackQrPreview = () => (_jsx("div", { className: "rounded-xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground", children: "Carregando QR Code\u2026" }));
const QrFlow = ({ surfaceStyles, open, onOpenChange, qrImageSrc, isGeneratingQrImage, qrStatusMessage, onGenerate, onOpenQrDialog, generateDisabled, openDisabled, pairingPhoneInput, onPairingPhoneChange, pairingDisabled, requestingPairingCode, onRequestPairingCode, pairingPhoneError, timelineItems, realtimeConnected, }) => {
    return (_jsx(Suspense, { fallback: _jsx(FallbackQrPreview, {}), children: _jsx(QrSection, { surfaceStyles: surfaceStyles, open: open, onOpenChange: onOpenChange, qrImageSrc: qrImageSrc, isGeneratingQrImage: isGeneratingQrImage, qrStatusMessage: qrStatusMessage, onGenerate: onGenerate, onOpenQrDialog: onOpenQrDialog, generateDisabled: generateDisabled, openDisabled: openDisabled, pairingPhoneInput: pairingPhoneInput, onPairingPhoneChange: onPairingPhoneChange, pairingDisabled: pairingDisabled, requestingPairingCode: requestingPairingCode, onRequestPairingCode: onRequestPairingCode, pairingPhoneError: pairingPhoneError, timelineItems: timelineItems, realtimeConnected: realtimeConnected }) }));
};
export default QrFlow;
