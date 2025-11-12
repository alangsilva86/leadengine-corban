import { Suspense } from 'react';

import QrSection from '../components/QrSection.jsx';

interface QrFlowProps {
  surfaceStyles: Record<string, string>;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  qrStatusMessage: string | null;
  pairingPhoneInput: string;
  onPairingPhoneChange: (event: any) => void;
  pairingDisabled: boolean;
  requestingPairingCode: boolean;
  onRequestPairingCode: () => void;
  pairingPhoneError: string | null;
  timelineItems: any[];
  realtimeConnected: boolean;
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
  qrStatusMessage,
  pairingPhoneInput,
  onPairingPhoneChange,
  pairingDisabled,
  requestingPairingCode,
  onRequestPairingCode,
  pairingPhoneError,
  timelineItems,
  realtimeConnected,
}: QrFlowProps) => {
  return (
    <Suspense fallback={<FallbackQrPreview />}>
      <QrSection
        surfaceStyles={surfaceStyles}
        open={open}
        onOpenChange={onOpenChange}
        qrStatusMessage={qrStatusMessage}
        pairingPhoneInput={pairingPhoneInput}
        onPairingPhoneChange={onPairingPhoneChange}
        pairingDisabled={pairingDisabled}
        requestingPairingCode={requestingPairingCode}
        onRequestPairingCode={onRequestPairingCode}
        pairingPhoneError={pairingPhoneError}
        timelineItems={timelineItems}
        realtimeConnected={realtimeConnected}
      />
    </Suspense>
  );
};

export default QrFlow;
