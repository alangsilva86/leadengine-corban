import { useCallback } from 'react';

import useWhatsappPairing from './hooks/useWhatsappPairing';
import useWhatsappSessionState from './hooks/useWhatsappSessionState';
import type { WhatsAppConnectAction, WhatsAppConnectState } from './useWhatsAppConnect';
import { resolveInstanceId } from './utils/instances';

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
  selectInstance: (inst: any, options?: { skipAutoQr?: boolean }) => Promise<void> | void;
  generateQr: (id: string) => Promise<void>;
  markConnected: () => Promise<boolean>;
  connectInstance: (instanceId: string, options?: any) => Promise<any>;
  loadInstances: (options?: any) => Promise<any>;
  setErrorMessage: (message: string | null, meta?: Partial<{ code: string | null; title: string | null }>) => void;
  selectedAgreementId: string | undefined;
  requestingPairingCode: boolean;
}

const useSessionUiState = ({
  state,
  dispatch,
  localStatus,
  qrData,
  secondsLeft,
  setSecondsLeft,
  setInstanceStatus,
  onStatusChange,
  setGeneratingQrState,
  loadingInstances,
  loadingQr,
  instance,
  realtimeConnected,
  selectInstance,
  generateQr,
  markConnected,
  connectInstance,
  loadInstances,
  setErrorMessage,
  selectedAgreementId,
  requestingPairingCode,
}: UseSessionUiStateParams) => {
  const setQrPanelOpen = useCallback(
    (value: boolean) => dispatch({ type: 'set-qr-panel-open', value }),
    [dispatch]
  );
  const setQrDialogOpen = useCallback(
    (value: boolean) => dispatch({ type: 'set-qr-dialog-open', value }),
    [dispatch]
  );
  const setPairingPhoneInput = useCallback(
    (value: string) => dispatch({ type: 'set-pairing-phone-input', value }),
    [dispatch]
  );
  const setPairingPhoneError = useCallback(
    (value: string | null) => dispatch({ type: 'set-pairing-phone-error', value }),
    [dispatch]
  );
  const setRequestingPairing = useCallback(
    (value: boolean) => dispatch({ type: 'set-requesting-pairing', value }),
    [dispatch]
  );

  const sessionState = useWhatsappSessionState({
    state,
    localStatus,
    qrData,
    secondsLeft,
    setSecondsLeft,
    setInstanceStatus,
    onStatusChange,
    setGeneratingQrState,
    loadingInstances,
    loadingQr,
    requestingPairingCode,
    instance,
    realtimeConnected,
    selectInstance,
    generateQr,
    markConnected,
    setQrPanelOpen,
    setQrDialogOpen,
  });

  const pairingState = useWhatsappPairing({
    state,
    setPairingPhoneInput,
    setPairingPhoneError,
    setRequestingPairing,
    instanceId: resolveInstanceId(instance) ?? undefined,
    selectedAgreementId,
    connectInstance,
    loadInstances,
    setErrorMessage,
  });

  return {
    ...sessionState,
    ...pairingState,
  };
};

export default useSessionUiState;
