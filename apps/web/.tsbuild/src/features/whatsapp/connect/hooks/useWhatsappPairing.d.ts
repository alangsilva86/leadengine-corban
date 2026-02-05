import type { WhatsAppConnectState } from '../useWhatsAppConnect';
interface UseWhatsappPairingParams {
    state: WhatsAppConnectState;
    setPairingPhoneInput: (value: string) => void;
    setPairingPhoneError: (value: string | null) => void;
    setRequestingPairing: (value: boolean) => void;
    instanceId: string | undefined;
    selectedAgreementId: string | undefined;
    connectInstance: (instanceId: string, options?: any) => Promise<any>;
    loadInstances: (options?: any) => Promise<any>;
    setErrorMessage: (message: string | null, meta?: Partial<{
        code: string | null;
        title: string | null;
    }>) => void;
}
declare const useWhatsappPairing: ({ state, setPairingPhoneInput, setPairingPhoneError, setRequestingPairing, instanceId, selectedAgreementId, connectInstance, loadInstances, setErrorMessage, }: UseWhatsappPairingParams) => {
    pairingPhoneInput: string;
    pairingPhoneError: string | null;
    requestingPairingCode: boolean;
    handlePairingPhoneChange: (event: any) => void;
    handleRequestPairingCode: () => Promise<void>;
};
export default useWhatsappPairing;
