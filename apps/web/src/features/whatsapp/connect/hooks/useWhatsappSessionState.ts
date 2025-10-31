import { useCallback, useEffect, useMemo, useState } from 'react';

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

const mergeQr = (primary: any, secondary: any) => {
  if (!primary) return secondary;
  if (!secondary) return primary;
  return {
    qr: primary.qr ?? secondary.qr ?? null,
    qrCode: primary.qrCode ?? secondary.qrCode ?? primary.qr ?? secondary.qr ?? null,
    qrExpiresAt: primary.qrExpiresAt ?? secondary.qrExpiresAt ?? null,
    expiresAt:
      primary.expiresAt ?? secondary.expiresAt ?? primary.qrExpiresAt ?? secondary.qrExpiresAt ?? null,
  };
};

const extractQrPayload = (payload: any) => {
  if (!payload) return null;

  const parseCandidate = (candidate: any): any => {
    if (!candidate) return null;

    if (typeof candidate === 'string') {
      return { qr: candidate, qrCode: candidate, qrExpiresAt: null, expiresAt: null };
    }

    if (typeof candidate !== 'object') {
      return null;
    }

    const source = candidate;

    const directQr =
      typeof source.qr === 'string'
        ? source.qr
        : typeof source.qrCode === 'string'
        ? source.qrCode
        : typeof source.qr_code === 'string'
        ? source.qr_code
        : typeof source.code === 'string'
        ? source.code
        : typeof source.image === 'string'
        ? source.image
        : typeof source.value === 'string'
        ? source.value
        : null;

    const qrCodeCandidate =
      typeof source.qrCode === 'string'
        ? source.qrCode
        : typeof source.qr_code === 'string'
        ? source.qr_code
        : null;

    const qrExpiresCandidate =
      typeof source.qrExpiresAt === 'string'
        ? source.qrExpiresAt
        : typeof source.qr_expires_at === 'string'
        ? source.qr_expires_at
        : null;

    const expiresCandidate =
      typeof source.expiresAt === 'string'
        ? source.expiresAt
        : typeof source.expiration === 'string'
        ? source.expiration
        : typeof source.expires === 'string'
        ? source.expires
        : null;

    let normalized = null;

    if (directQr || qrCodeCandidate || qrExpiresCandidate || expiresCandidate) {
      normalized = {
        qr: directQr ?? qrCodeCandidate ?? null,
        qrCode: qrCodeCandidate ?? directQr ?? null,
        qrExpiresAt: qrExpiresCandidate ?? null,
        expiresAt: expiresCandidate ?? qrExpiresCandidate ?? null,
      };
    }

    const nestedCandidates = [
      source.qr,
      source.qrData,
      source.qrPayload,
      source.qr_info,
      source.data,
      source.payload,
      source.result,
      source.response,
    ];

    for (const nestedSource of nestedCandidates) {
      const nested = parseCandidate(nestedSource);
      if (nested) {
        normalized = mergeQr(normalized, nested);
        break;
      }
    }

    return normalized;
  };

  const normalized = parseCandidate(payload);

  if (!normalized) {
    return null;
  }

  const finalPayload: any = { ...normalized };
  if (!finalPayload.qr && finalPayload.qrCode) {
    finalPayload.qr = finalPayload.qrCode;
  }
  if (!finalPayload.qrCode && finalPayload.qr) {
    finalPayload.qrCode = finalPayload.qr;
  }
  if (!finalPayload.expiresAt && finalPayload.qrExpiresAt) {
    finalPayload.expiresAt = finalPayload.qrExpiresAt;
  }
  if (!finalPayload.qrExpiresAt && finalPayload.expiresAt) {
    finalPayload.qrExpiresAt = finalPayload.expiresAt;
  }

  return finalPayload;
};

const getQrImageSrc = (qrPayload: any) => {
  if (!qrPayload) {
    return { code: null, immediate: null, needsGeneration: false, isBaileys: false };
  }

  const payload = extractQrPayload(qrPayload);
  if (!payload) {
    return { code: null, immediate: null, needsGeneration: false, isBaileys: false };
  }

  const { qr } = payload;
  if (!qr || typeof qr !== 'string') {
    return { code: null, immediate: null, needsGeneration: false, isBaileys: false };
  }

  const normalized = qr.trim();
  if (normalized.startsWith('data:image')) {
    return { code: normalized, immediate: normalized, needsGeneration: false, isBaileys: false };
  }

  if (/^https?:\/\//i.test(normalized)) {
    return { code: normalized, immediate: normalized, needsGeneration: false, isBaileys: false };
  }

  if (/^[A-Za-z0-9+/=]+$/.test(normalized) && normalized.length > 100) {
    return {
      code: normalized,
      immediate: `data:image/png;base64,${normalized}`,
      needsGeneration: false,
      isBaileys: false,
    };
  }

  const isBaileys = /BAILEYS/i.test(normalized);

  return {
    code: normalized,
    immediate: null,
    needsGeneration: true,
    isBaileys,
  };
};

const useQrImageSource = (qrPayload: any) => {
  const qrMeta = useMemo(() => getQrImageSrc(qrPayload), [qrPayload]);
  const { code, immediate, needsGeneration } = qrMeta;
  const [src, setSrc] = useState<string | null>(immediate ?? null);
  const [isGenerating, setIsGenerating] = useState<boolean>(Boolean(needsGeneration && !immediate));

  useEffect(() => {
    let cancelled = false;

    if (immediate) {
      setSrc(immediate);
      setIsGenerating(false);
      return () => {
        cancelled = true;
      };
    }

    if (!code || !needsGeneration) {
      setSrc(null);
      setIsGenerating(false);
      return () => {
        cancelled = true;
      };
    }

    setSrc(null);
    setIsGenerating(true);
    import('qrcode')
      .then(({ toDataURL }) => toDataURL(code, { type: 'image/png', errorCorrectionLevel: 'M', margin: 1 }))
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Falha ao gerar QR Code', error);
          setSrc(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsGenerating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, immediate, needsGeneration]);

  return { src, isGenerating };
};

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
  onContinue?: () => void;
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
  onContinue,
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

  const { src: qrImageSrc, isGenerating: isGeneratingQrImage } = useQrImageSource(qrData);

  useEffect(() => {
    setGeneratingQrState(isGeneratingQrImage);
  }, [isGeneratingQrImage, setGeneratingQrState]);

  const countdownMessage = secondsLeft !== null ? `QR expira em ${secondsLeft}s` : null;

  const isBusy = loadingInstances || loadingQr || isGeneratingQrImage || requestingPairingCode;
  const canContinue = localStatus === 'connected' && Boolean(instance);
  const confirmLabel = 'Ir para a inbox de leads';
  const confirmDisabled = !canContinue || isBusy;

  const qrStatusMessage =
    localStatus === 'connected'
      ? 'Conexão ativa — QR oculto.'
      : countdownMessage || (loadingQr || isGeneratingQrImage ? 'Gerando QR Code…' : 'Selecione uma instância para gerar o QR.');

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

  const handleConfirm = useCallback(() => {
    if (!canContinue) {
      return;
    }
    onContinue?.();
  }, [canContinue, onContinue]);

  const statusTone = statusCopy.tone || STATUS_TONES.fallback;

  return {
    statusCopy,
    statusTone,
    countdownMessage,
    qrImageSrc,
    isGeneratingQrImage,
    qrStatusMessage,
    confirmLabel,
    confirmDisabled,
    isBusy,
    canContinue,
    qrPanelOpen: state.qrPanelOpen,
    isQrDialogOpen: state.isQrDialogOpen,
    handleConfirm,
    handleViewQr,
    handleGenerateQr,
    handleMarkConnected,
  };
};

export default useWhatsappSessionState;
export { STATUS_TONES, STATUS_COPY };
