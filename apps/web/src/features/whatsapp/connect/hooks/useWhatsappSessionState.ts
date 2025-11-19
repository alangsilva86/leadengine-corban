import { useCallback, useEffect, useMemo } from 'react';

import useQrImageSource from '../../hooks/useQrImageSource.js';
import type { WhatsAppConnectState } from '../useWhatsAppConnect';

const STATUS_TONES = {
  disconnected: 'warning',
  connecting: 'info',
  connected: 'success',
  qr_required: 'warning',
  fallback: 'neutral',
} as const;

const STATUS_COPY = {
  disconnected: {
    badge: 'Pendente',
    description:
      'Leia o QR Code no WhatsApp Web para conectar seu número e começar a receber leads.',
    tone: STATUS_TONES.disconnected,
  },
  connecting: {
    badge: 'Conectando',
    description: 'Estamos sincronizando com o seu número. Mantenha o WhatsApp aberto até concluir.',
    tone: STATUS_TONES.connecting,
  },
  connected: {
    badge: 'Ativo',
    description: 'Pronto! Todos os leads qualificados serão entregues diretamente no seu WhatsApp.',
    tone: STATUS_TONES.connected,
  },
  qr_required: {
    badge: 'QR necessário',
    description: 'Gere um novo QR Code e escaneie para reativar a sessão.',
    tone: STATUS_TONES.qr_required,
  },
} as const;

interface UseWhatsappSessionStateParams {
  state: WhatsAppConnectState;
  localStatus: string;
  qrData: any;
  secondsLeft: number | null;
  setSecondsLeft: (value: number | null) => void;
  setInstanceStatus: (status: string) => void;
  onStatusChange?: (status: string) => void;
  setGeneratingQrState: (value: boolean) => void;
  loadingInstances: boolean;
  loadingQr: boolean;
  requestingPairingCode: boolean;
  instance: any;
  selectInstance: (inst: any, options?: { skipAutoQr?: boolean }) => Promise<void>;
  generateQr: (id: string) => Promise<void>;
  markConnected: () => Promise<boolean>;
  setQrPanelOpen: (value: boolean) => void;
  setQrDialogOpen: (value: boolean) => void;
}

const useWhatsappSessionState = ({
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
  selectInstance,
  generateQr,
  markConnected,
  setQrPanelOpen,
  setQrDialogOpen,
}: UseWhatsappSessionStateParams) => {
  useEffect(() => {
    setQrPanelOpen(localStatus !== 'connected');
  }, [localStatus, setQrPanelOpen]);

  const expiresAt = useMemo(() => {
    if (!qrData?.expiresAt) return null;
    return new Date(qrData.expiresAt).getTime();
  }, [qrData]);

  useEffect(() => {
    if (!expiresAt || localStatus === 'connected') {
      setSecondsLeft(null);
      return undefined;
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        if (localStatus !== 'connected' && localStatus !== 'connecting') {
          setInstanceStatus('qr_required');
          onStatusChange?.('disconnected');
        }
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, localStatus, onStatusChange, setSecondsLeft, setInstanceStatus]);

  const statusCopy = STATUS_COPY[localStatus as keyof typeof STATUS_COPY] ?? STATUS_COPY.disconnected;

  const {
    src: qrImageSrc,
    isGenerating: isGeneratingQrImage,
    meta: qrMeta,
  } = useQrImageSource(qrData);

  const qrUnavailableMessage = useMemo(() => {
    if (!qrMeta || qrMeta.available !== false) {
      return null;
    }
    const reason = typeof qrMeta.reason === 'string' ? qrMeta.reason.toUpperCase() : null;
    if (reason === 'EXPIRED') {
      return 'O QR Code anterior expirou. Gere um novo para continuar.';
    }
    return 'O conector está gerando o QR Code. Aguarde alguns segundos e tente novamente.';
  }, [qrMeta]);

  useEffect(() => {
    setGeneratingQrState(isGeneratingQrImage);
  }, [isGeneratingQrImage, setGeneratingQrState]);

  const countdownMessage = secondsLeft !== null ? `QR expira em ${secondsLeft}s` : null;

  const isBusy = loadingInstances || loadingQr || isGeneratingQrImage || requestingPairingCode;
  const canContinue = localStatus === 'connected' && Boolean(instance);

  const qrStatusMessage =
    localStatus === 'connected'
      ? 'Conexão ativa — QR oculto.'
      : qrUnavailableMessage ||
        countdownMessage ||
        (loadingQr || isGeneratingQrImage ? 'Gerando QR Code…' : 'Selecione uma instância para gerar o QR.');

  const handleViewQr = useCallback(
    async (inst: any) => {
      if (!inst) return;
      await selectInstance(inst, { skipAutoQr: true });
      await generateQr(inst.id);
      setQrDialogOpen(true);
    },
    [generateQr, selectInstance, setQrDialogOpen]
  );

  const handleGenerateQr = useCallback(async () => {
    if (!instance?.id) return;
    await generateQr(instance.id);
  }, [generateQr, instance?.id]);

  const handleMarkConnected = useCallback(async () => {
    const success = await markConnected();
    if (success) {
      setQrDialogOpen(false);
    }
  }, [markConnected, setQrDialogOpen]);

  const statusTone = statusCopy.tone || STATUS_TONES.fallback;

  return {
    statusCopy,
    statusTone,
    countdownMessage,
    qrImageSrc,
    isGeneratingQrImage,
    qrStatusMessage,
    isBusy,
    canContinue,
    qrPanelOpen: state.qrPanelOpen,
    isQrDialogOpen: state.isQrDialogOpen,
    handleViewQr,
    handleGenerateQr,
    handleMarkConnected,
  };
};

export default useWhatsappSessionState;
export { STATUS_TONES, STATUS_COPY };
