import { Suspense } from 'react';

import QrSection from '../components/QrSection.jsx';

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
  humanizeLabel: (value: unknown) => string;
  formatPhoneNumber: (value: unknown) => string;
  formatTimestampLabel: (value: unknown) => string;
}

const FallbackQrPreview = () => (
  <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
    Carregando QR Code…
  </div>
);

const QrFlow = ({
  surfaceStyles,
  open,
  onOpenChange,
  qrImageSrc,
  isGeneratingQrImage,
  qrStatusMessage,
  onGenerate,
  onOpenQrDialog,
  generateDisabled,
  openDisabled,
  pairingPhoneInput,
  onPairingPhoneChange,
  pairingDisabled,
  requestingPairingCode,
  onRequestPairingCode,
  pairingPhoneError,
  timelineItems,
  realtimeConnected,
  humanizeLabel,
  formatPhoneNumber,
  formatTimestampLabel,
}: QrFlowProps) => {
  return (
    <Suspense fallback={<FallbackQrPreview />}>
      <QrSection
        surfaceStyles={surfaceStyles}
        open={open}
        onOpenChange={onOpenChange}
        qrImageSrc={qrImageSrc}
        isGeneratingQrImage={isGeneratingQrImage}
        qrStatusMessage={qrStatusMessage}
        onGenerate={onGenerate}
        onOpenQrDialog={onOpenQrDialog}
        generateDisabled={generateDisabled}
        openDisabled={openDisabled}
        pairingPhoneInput={pairingPhoneInput}
        onPairingPhoneChange={onPairingPhoneChange}
        pairingDisabled={pairingDisabled}
        requestingPairingCode={requestingPairingCode}
        onRequestPairingCode={onRequestPairingCode}
        pairingPhoneError={pairingPhoneError}
        timelineItems={timelineItems}
        realtimeConnected={realtimeConnected}
        humanizeLabel={humanizeLabel}
        formatPhoneNumber={formatPhoneNumber}
        formatTimestampLabel={formatTimestampLabel}
      />
    </Suspense>
  );
};

export default QrFlow;
