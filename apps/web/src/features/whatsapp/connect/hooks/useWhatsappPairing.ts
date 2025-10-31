import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import { pairingPhoneSchema } from '../schemas';
import { requestPairingCode as requestPairingCodeService } from '../services/pairingService';
import { resolveWhatsAppErrorCopy } from '../../utils/whatsapp-error-codes.js';
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
  setErrorMessage: (message: string | null, meta?: Partial<{ code: string | null; title: string | null }>) => void;
}

const useWhatsappPairing = ({
  state,
  setPairingPhoneInput,
  setPairingPhoneError,
  setRequestingPairing,
  instanceId,
  selectedAgreementId,
  connectInstance,
  loadInstances,
  setErrorMessage,
}: UseWhatsappPairingParams) => {
  useEffect(() => {
    setPairingPhoneInput('');
    setPairingPhoneError(null);
  }, [instanceId, selectedAgreementId, setPairingPhoneError, setPairingPhoneInput]);

  const resolveFriendlyError = useCallback((error: any, fallbackMessage: string) => {
    const codeCandidate = error?.payload?.error?.code ?? error?.code ?? null;
    const rawMessage =
      error?.payload?.error?.message ?? (error instanceof Error ? error.message : fallbackMessage);
    const copy = resolveWhatsAppErrorCopy(codeCandidate, rawMessage ?? fallbackMessage);
    return {
      code: copy.code,
      title: copy.title,
      message: copy.description ?? rawMessage ?? fallbackMessage,
    };
  }, []);

  const handlePairingPhoneChange = useCallback(
    (event: any) => {
      const value = typeof event?.target?.value === 'string' ? event.target.value : '';
      setPairingPhoneInput(value);
      if (state.pairingPhoneError) {
        setPairingPhoneError(null);
      }
    },
    [setPairingPhoneInput, setPairingPhoneError, state.pairingPhoneError]
  );

  const handleRequestPairingCode = useCallback(async () => {
    if (!instanceId) {
      setPairingPhoneError('Selecione uma instância para solicitar o pareamento por código.');
      return;
    }

    const validation = pairingPhoneSchema.safeParse({ phone: state.pairingPhoneInput });
    if (!validation.success) {
      const message = validation.error.errors[0]?.message ?? 'Informe o telefone que receberá o código.';
      setPairingPhoneError(message);
      return;
    }

    setPairingPhoneError(null);
    setRequestingPairing(true);
    try {
      const result = await requestPairingCodeService(connectInstance, instanceId, validation.data.phone);
      await loadInstances({
        connectResult: result || undefined,
        preferredInstanceId: instanceId,
        forceRefresh: true,
      });
      toast.success(
        'Solicitamos o código de pareamento. Abra o WhatsApp oficial e informe o código recebido para concluir a conexão.'
      );
    } catch (err: any) {
      const friendly = resolveFriendlyError(
        err,
        'Não foi possível solicitar o pareamento por código. Verifique o telefone informado e tente novamente.'
      );
      setPairingPhoneError(friendly.message);
      setErrorMessage(friendly.message, {
        code: friendly.code ?? null,
        title: friendly.title ?? 'Falha ao solicitar pareamento por código',
      });
    } finally {
      setRequestingPairing(false);
    }
  }, [
    instanceId,
    state.pairingPhoneInput,
    connectInstance,
    loadInstances,
    resolveFriendlyError,
    setErrorMessage,
    setPairingPhoneError,
    setRequestingPairing,
  ]);

  return {
    pairingPhoneInput: state.pairingPhoneInput,
    pairingPhoneError: state.pairingPhoneError,
    requestingPairingCode: state.requestingPairingCode,
    handlePairingPhoneChange,
    handleRequestPairingCode,
  };
};

export default useWhatsappPairing;
