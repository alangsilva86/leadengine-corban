import { useCallback, useEffect, useMemo } from 'react';
import useQrImageSource from '../../hooks/useQrImageSource.js';
const STATUS_TONES = {
    disconnected: 'warning',
    connecting: 'info',
    connected: 'success',
    qr_required: 'warning',
    fallback: 'neutral',
};
const STATUS_COPY = {
    disconnected: {
        badge: 'Pendente',
        description: 'Leia o QR Code no WhatsApp Web para conectar seu número e começar a receber leads.',
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
};
const useWhatsappSessionState = ({ state, localStatus, qrData, secondsLeft, setSecondsLeft, setInstanceStatus, onStatusChange, setGeneratingQrState, loadingInstances, loadingQr, requestingPairingCode, instance, realtimeConnected, selectInstance, generateQr, markConnected, setQrPanelOpen, setQrDialogOpen, }) => {
    useEffect(() => {
        setQrPanelOpen(localStatus !== 'connected');
    }, [localStatus, setQrPanelOpen]);
    const expiresAt = useMemo(() => {
        if (!qrData?.expiresAt)
            return null;
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
    const statusCopy = STATUS_COPY[localStatus] ?? STATUS_COPY.disconnected;
    const { src: qrImageSrc, isGenerating: isGeneratingQrImage, meta: qrMeta, } = useQrImageSource(qrData);
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
    const canContinue = realtimeConnected && localStatus === 'connected' && Boolean(instance);
    const qrStatusMessage = localStatus === 'connected'
        ? 'Conexão ativa — QR oculto.'
        : qrUnavailableMessage ||
            countdownMessage ||
            (loadingQr || isGeneratingQrImage ? 'Gerando QR Code…' : 'Selecione uma instância para gerar o QR.');
    const resolveInstanceId = useCallback((target) => {
        if (!target)
            return null;
        if (typeof target === 'string')
            return target;
        if (typeof target.id === 'string' && target.id.trim().length > 0) {
            return target.id.trim();
        }
        if (target.instance && typeof target.instance.id === 'string') {
            return target.instance.id.trim();
        }
        return null;
    }, []);
    const handleViewQr = useCallback(async (inst) => {
        const targetId = resolveInstanceId(inst);
        if (!targetId)
            return;
        await selectInstance(targetId, { skipAutoQr: true });
        await generateQr(targetId);
        setQrDialogOpen(true);
    }, [generateQr, selectInstance, setQrDialogOpen, resolveInstanceId]);
    const handleGenerateQr = useCallback(async () => {
        const targetId = resolveInstanceId(instance);
        if (!targetId)
            return;
        await generateQr(targetId);
    }, [generateQr, instance, resolveInstanceId]);
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
