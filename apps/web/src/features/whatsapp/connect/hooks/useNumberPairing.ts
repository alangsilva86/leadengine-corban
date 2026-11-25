import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import useQrImageSource from '../../hooks/useQrImageSource.js';
import { useInstancesStore } from '../../state/instancesStore';
import { resolveWhatsAppError } from '../../lib/errors';
import { extractWhatsAppDigits } from '@/lib/phone';

/** Quando a API não informa a validade do QR, renovamos no ritmo do próprio WhatsApp (~20s). */
export const QR_FALLBACK_TTL_SECONDS = 20;
/** Depois de N renovações sem leitura, pausamos para não gerar QR à toa. */
export const MAX_QR_ATTEMPTS = 5;
const STATUS_POLL_MS = 5_000;

export type QrPhase = 'idle' | 'loading' | 'ready' | 'paused' | 'error';
export type CodePhase = 'idle' | 'requesting' | 'ready' | 'error';

interface PairingDeps {
  generateQr: (instanceId: string, options?: { refresh?: boolean }) => Promise<void> | void;
  setQrData: (value: unknown) => void;
  connectInstance: (
    instanceId: string,
    pairing?: { phoneNumber?: string },
    options?: { notify?: boolean },
  ) => Promise<any>;
  checkInstanceStatus: (instanceId: string) => Promise<boolean>;
}

interface UseNumberPairingParams {
  deps: PairingDeps;
  instanceId: string | null;
  /** A etapa de pareamento está visível. */
  active: boolean;
  method: 'qr' | 'code';
  /** O número já aparece como conectado na lista. */
  connected: boolean;
}

/**
 * Ciclo de vida do pareamento de um número: QR com renovação limitada, código por telefone
 * e verificação periódica do status enquanto a etapa está aberta.
 */
const useNumberPairing = ({ deps, instanceId, active, method, connected }: UseNumberPairingParams) => {
  const qrData = useInstancesStore((state: any) => state.qrData);
  const qrState = useInstancesStore((state: any) => state.qrState);
  const loadingQr = useInstancesStore((state: any) => state.loadingQr);
  const storeError = useInstancesStore((state: any) => state.error);

  const [attempts, setAttempts] = useState(0);
  const [paused, setPaused] = useState(false);
  const [requested, setRequested] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [codePhase, setCodePhase] = useState<CodePhase>('idle');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const depsRef = useRef(deps);
  depsRef.current = deps;

  const qrForTarget = instanceId && qrState?.instanceId === instanceId ? qrData : null;
  const { src: qrSrc, isGenerating, meta } = useQrImageSource(qrForTarget);
  const qrUnavailable = Boolean(qrForTarget) && meta?.available === false;

  const requestQr = useCallback(() => {
    if (!instanceId) return;
    depsRef.current.setQrData(null);
    setRequested(true);
    setDeadline(null);
    void depsRef.current.generateQr(instanceId, { refresh: true });
  }, [instanceId]);

  /** "Gerar novo": zera o limite de renovações. */
  const restartQr = useCallback(() => {
    setPaused(false);
    setAttempts(1);
    requestQr();
  }, [requestQr]);

  // Reinicia tudo quando o número muda.
  useEffect(() => {
    setAttempts(0);
    setPaused(false);
    setRequested(false);
    setDeadline(null);
    setCodePhase('idle');
    setPairingCode(null);
    setCodeError(null);
  }, [instanceId]);

  // Primeiro QR ao abrir a aba "QR Code".
  useEffect(() => {
    if (!active || method !== 'qr' || connected || !instanceId || paused || attempts > 0) {
      return;
    }
    setAttempts(1);
    requestQr();
  }, [active, attempts, connected, instanceId, method, paused, requestQr]);

  // Define o prazo de cada QR recebido: o informado pela API ou o ritmo padrão do WhatsApp.
  useEffect(() => {
    if (!qrSrc || !qrForTarget) {
      return;
    }
    const apiExpiresAt = typeof qrState?.expiresAt === 'number' ? qrState.expiresAt : null;
    setDeadline(apiExpiresAt && apiExpiresAt > Date.now() ? apiExpiresAt : Date.now() + QR_FALLBACK_TTL_SECONDS * 1000);
  }, [qrForTarget, qrSrc, qrState?.expiresAt]);

  // Relógio da contagem regressiva (só enquanto há QR na tela).
  useEffect(() => {
    if (!active || method !== 'qr' || !deadline || paused || connected) {
      return undefined;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active, connected, deadline, method, paused]);

  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  // QR venceu: renova até o limite e depois pausa.
  useEffect(() => {
    if (!active || method !== 'qr' || connected || paused || secondsLeft !== 0) {
      return;
    }
    if (attempts >= MAX_QR_ATTEMPTS) {
      setPaused(true);
      setDeadline(null);
      return;
    }
    setAttempts((value) => value + 1);
    requestQr();
  }, [active, attempts, connected, method, paused, requestQr, secondsLeft]);

  // O conector ainda está preparando o QR: tenta de novo em instantes (conta como renovação).
  useEffect(() => {
    if (!active || method !== 'qr' || !qrUnavailable || paused || connected) {
      return undefined;
    }
    const timer = setTimeout(() => {
      if (attempts >= MAX_QR_ATTEMPTS) {
        setPaused(true);
        return;
      }
      setAttempts((value) => value + 1);
      requestQr();
    }, 4_000);
    return () => clearTimeout(timer);
  }, [active, attempts, connected, method, paused, qrUnavailable, requestQr]);

  const qrPhase: QrPhase = useMemo(() => {
    if (paused) return 'paused';
    if (qrSrc && !qrUnavailable) return 'ready';
    if (requested && !loadingQr && !isGenerating && !qrForTarget && storeError) return 'error';
    if (requested || loadingQr || isGenerating || qrUnavailable) return 'loading';
    return 'idle';
  }, [isGenerating, loadingQr, paused, qrForTarget, qrSrc, qrUnavailable, requested, storeError]);

  const qrError = qrPhase === 'error' ? resolveWhatsAppError(storeError, 'Não foi possível gerar o QR Code') : null;

  // Verifica o status enquanto há um QR ou código na tela (o tempo real também avisa; isto é a rede de segurança).
  const awaitingScan = (method === 'qr' && qrPhase === 'ready') || (method === 'code' && codePhase === 'ready');
  useEffect(() => {
    if (!active || !instanceId || connected || !awaitingScan) {
      return undefined;
    }
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void depsRef.current.checkInstanceStatus(instanceId);
    }, STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [active, awaitingScan, connected, instanceId]);

  const requestPairingCode = useCallback(
    async (phoneInput: string) => {
      if (!instanceId) return;
      const digits = extractWhatsAppDigits(phoneInput);
      if (!digits || digits.length < 10) {
        setCodePhase('error');
        setCodeError('Informe o número com DDD, por exemplo (11) 91234-5678.');
        return;
      }
      const international = digits.length <= 11 ? `55${digits}` : digits;
      setCodePhase('requesting');
      setCodeError(null);
      setPairingCode(null);
      try {
        const result = await depsRef.current.connectInstance(
          instanceId,
          { phoneNumber: international },
          { notify: false },
        );
        if (result?.pairingCode) {
          setPairingCode(result.pairingCode);
          setCodePhase('ready');
          return;
        }
        setCodePhase('error');
        setCodeError(
          'O código não foi gerado desta vez. Tente de novo em instantes ou use o QR Code em um computador.',
        );
      } catch (error: any) {
        setCodePhase('error');
        if (error?.status === 404 || error?.status === 405 || error?.status === 501) {
          setCodeError(
            'O pareamento por código ainda não está disponível. Abra esta página em um computador e use o QR Code.',
          );
          return;
        }
        setCodeError(resolveWhatsAppError(error, 'Não foi possível gerar o código').message);
      }
    },
    [instanceId],
  );

  return {
    qrPhase,
    qrSrc: qrPhase === 'ready' ? qrSrc : null,
    qrError,
    secondsLeft: qrPhase === 'ready' ? secondsLeft : null,
    attempts,
    restartQr,
    codePhase,
    pairingCode,
    codeError,
    requestPairingCode,
  };
};

export default useNumberPairing;
