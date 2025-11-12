import type {
  InstancesStoreState,
  QrSlice,
  StoreEvents,
} from './types';

export const createQrSlice = (
  set: (
    partial:
      | Partial<InstancesStoreState>
      | ((state: InstancesStoreState) => Partial<InstancesStoreState>),
    replace?: boolean,
  ) => void,
  get: () => InstancesStoreState,
  events: StoreEvents,
): QrSlice => ({
  qrData: null,
  qrState: { instanceId: null, expiresAt: null },
  secondsLeft: null,
  loadingQr: false,
  generatingQr: false,

  generateQr(payload) {
    set({
      loadingQr: true,
      generatingQr: true,
      qrState: { instanceId: payload.instanceId, expiresAt: null },
    });
    events.emit('qr:generate', payload);
  },

  applyQrResult({ instanceId, qr, expiresAt = null, secondsLeft = null }) {
    const nextSeconds =
      typeof secondsLeft === 'number'
        ? secondsLeft
        : expiresAt
          ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
          : null;
    set({
      qrData: qr,
      loadingQr: false,
      generatingQr: false,
      secondsLeft: nextSeconds,
      qrState: { instanceId, expiresAt },
    });
  },

  failQr(instanceId) {
    const state = get();
    if (state.qrState.instanceId !== instanceId) {
      return;
    }
    set({
      loadingQr: false,
      generatingQr: false,
    });
  },

  setQrData(value) {
    set({ qrData: value ?? null });
  },

  setSecondsLeft(value) {
    set({ secondsLeft: value });
  },

  resetQr() {
    set({
      qrData: null,
      secondsLeft: null,
      loadingQr: false,
      generatingQr: false,
      qrState: { instanceId: null, expiresAt: null },
    });
    events.emit('qr:reset', undefined);
  },

  setLoadingQr(value) {
    const state = get();
    set({ loadingQr: value, generatingQr: value ? true : state.generatingQr });
  },

  setGeneratingQr(value) {
    set({ generatingQr: Boolean(value) });
  },
});
