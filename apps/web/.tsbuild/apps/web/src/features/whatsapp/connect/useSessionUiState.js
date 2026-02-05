import { useCallback } from 'react';
import useWhatsappPairing from './hooks/useWhatsappPairing';
import useWhatsappSessionState from './hooks/useWhatsappSessionState';
import { resolveInstanceId } from './utils/instances';
const useSessionUiState = ({ state, dispatch, localStatus, qrData, secondsLeft, setSecondsLeft, setInstanceStatus, onStatusChange, setGeneratingQrState, loadingInstances, loadingQr, instance, realtimeConnected, selectInstance, generateQr, markConnected, connectInstance, loadInstances, setErrorMessage, selectedAgreementId, requestingPairingCode, }) => {
    const setQrPanelOpen = useCallback((value) => dispatch({ type: 'set-qr-panel-open', value }), [dispatch]);
    const setQrDialogOpen = useCallback((value) => dispatch({ type: 'set-qr-dialog-open', value }), [dispatch]);
    const setPairingPhoneInput = useCallback((value) => dispatch({ type: 'set-pairing-phone-input', value }), [dispatch]);
    const setPairingPhoneError = useCallback((value) => dispatch({ type: 'set-pairing-phone-error', value }), [dispatch]);
    const setRequestingPairing = useCallback((value) => dispatch({ type: 'set-requesting-pairing', value }), [dispatch]);
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
