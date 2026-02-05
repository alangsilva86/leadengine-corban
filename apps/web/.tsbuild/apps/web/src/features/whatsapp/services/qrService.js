import { parseInstancesPayload } from '../lib/instances';
const readExpiresAt = (qr) => {
    if (!qr || typeof qr !== 'object') {
        return null;
    }
    const record = qr;
    const candidate = typeof record.expiresAt === 'string'
        ? record.expiresAt
        : typeof record.expires_at === 'string'
            ? record.expires_at
            : typeof record.qrExpiresAt === 'string'
                ? record.qrExpiresAt
                : typeof record.qr_expires_at === 'string'
                    ? record.qr_expires_at
                    : null;
    if (!candidate) {
        return null;
    }
    const timestamp = Date.parse(candidate);
    return Number.isFinite(timestamp) ? timestamp : null;
};
export const createQrService = ({ store, events, api, logger }) => {
    const log = logger?.log ?? (() => { });
    const warn = logger?.warn ?? (() => { });
    const errorLog = logger?.error ?? (() => { });
    let countdownId = null;
    const clearCountdown = () => {
        if (countdownId) {
            clearInterval(countdownId);
            countdownId = null;
        }
    };
    const startCountdown = (expiresAt) => {
        clearCountdown();
        if (!expiresAt) {
            store.getState().setSecondsLeft(null);
            return;
        }
        const tick = () => {
            const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            store.getState().setSecondsLeft(diff);
            if (diff <= 0) {
                clearCountdown();
            }
        };
        tick();
        countdownId = setInterval(tick, 1000);
    };
    const handleGenerate = async (payload) => {
        const encodedId = encodeURIComponent(payload.instanceId);
        const query = payload.refresh ? '?refresh=1' : '';
        const snapshots = payload.fetchSnapshots === false ? '&snapshots=0' : '';
        const endpoint = `/api/integrations/whatsapp/instances/${encodedId}/qr${query}${snapshots}`;
        try {
            log('Gerando QR Code para instância WhatsApp', {
                instanceId: payload.instanceId,
                refresh: payload.refresh ?? false,
            });
            const response = await api.get(endpoint);
            const parsed = parseInstancesPayload(response);
            const qr = parsed.qr ?? null;
            const expiresAt = readExpiresAt(qr);
            store.getState().applyQrResult({
                instanceId: payload.instanceId,
                qr,
                expiresAt,
            });
            startCountdown(expiresAt);
        }
        catch (err) {
            errorLog('Falha ao gerar QR Code da instância WhatsApp', err);
            clearCountdown();
            store.getState().failQr(payload.instanceId);
            const fallbackMessage = 'Não foi possível gerar o QR Code no momento devido a uma indisponibilidade externa. Usaremos os dados recentes e você pode tentar novamente em instantes.';
            store.getState().setError({
                message: err instanceof Error && err.message ? err.message : fallbackMessage,
                code: null,
            });
        }
    };
    const handleReset = () => {
        clearCountdown();
    };
    const unsubscribes = [
        events.on('qr:generate', handleGenerate),
        events.on('qr:reset', handleReset),
    ];
    return () => {
        clearCountdown();
        unsubscribes.forEach((dispose) => dispose());
    };
};
