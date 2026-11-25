/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useNumberPairing, { MAX_QR_ATTEMPTS, QR_FALLBACK_TTL_SECONDS } from '../hooks/useNumberPairing';

const storeRef = vi.hoisted(() => ({ current: null as any }));

vi.mock('../../state/instancesStore', async () => {
  const { createStore } = await import('zustand/vanilla');
  const { useStore } = await import('zustand');
  const store = createStore(() => ({
    qrData: null as any,
    qrState: { instanceId: null as string | null, expiresAt: null as number | null },
    loadingQr: false,
    error: null,
  }));
  storeRef.current = store;
  return { useInstancesStore: (selector: any) => useStore(store, selector) };
});

vi.mock('../../hooks/useQrImageSource.js', () => ({
  __esModule: true,
  default: (qr: any) => ({
    src: qr ? `data:image/png;base64,${qr.qr}` : null,
    isGenerating: false,
    meta: { available: Boolean(qr) },
  }),
}));

const buildDeps = () => {
  let counter = 0;
  return {
    generateQr: vi.fn((instanceId: string) => {
      counter += 1;
      storeRef.current.setState({
        qrData: { qr: `QR${counter}` },
        qrState: { instanceId, expiresAt: null },
        loadingQr: false,
      });
    }),
    setQrData: vi.fn((value: unknown) => storeRef.current.setState({ qrData: value })),
    connectInstance: vi.fn(() => Promise.resolve({ pairingCode: 'K7QX2M9P' })),
    checkInstanceStatus: vi.fn(() => Promise.resolve(false)),
  };
};

describe('useNumberPairing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storeRef.current.setState({ qrData: null, qrState: { instanceId: null, expiresAt: null }, loadingQr: false, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(`renova o QR sozinho até ${MAX_QR_ATTEMPTS} vezes e depois pausa`, async () => {
    const deps = buildDeps();
    const { result } = renderHook(() =>
      useNumberPairing({ deps, instanceId: 'n1', active: true, method: 'qr', connected: false }),
    );

    expect(deps.generateQr).toHaveBeenCalledTimes(1);
    expect(result.current.qrPhase).toBe('ready');
    expect(result.current.secondsLeft).toBe(QR_FALLBACK_TTL_SECONDS);

    for (let attempt = 2; attempt <= MAX_QR_ATTEMPTS; attempt += 1) {
      await act(async () => {
        vi.advanceTimersByTime(QR_FALLBACK_TTL_SECONDS * 1000 + 1000);
      });
      expect(deps.generateQr).toHaveBeenCalledTimes(attempt);
    }

    await act(async () => {
      vi.advanceTimersByTime(QR_FALLBACK_TTL_SECONDS * 1000 + 1000);
    });
    expect(deps.generateQr).toHaveBeenCalledTimes(MAX_QR_ATTEMPTS);
    expect(result.current.qrPhase).toBe('paused');

    await act(async () => {
      result.current.restartQr();
    });
    expect(deps.generateQr).toHaveBeenCalledTimes(MAX_QR_ATTEMPTS + 1);
    expect(result.current.qrPhase).toBe('ready');
  });

  it('não gera QR enquanto a aba de código está aberta e devolve o código de pareamento', async () => {
    const deps = buildDeps();
    const { result } = renderHook(() =>
      useNumberPairing({ deps, instanceId: 'n1', active: true, method: 'code', connected: false }),
    );
    expect(deps.generateQr).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.requestPairingCode('(11) 91234-5678');
    });
    expect(deps.connectInstance).toHaveBeenCalledWith('n1', { phoneNumber: '5511912345678' }, { notify: false });
    expect(result.current.pairingCode).toBe('K7QX2M9P');
    expect(result.current.codePhase).toBe('ready');
  });

  it('explica quando o pareamento por código não está disponível', async () => {
    const deps = buildDeps();
    deps.connectInstance.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }));
    const { result } = renderHook(() =>
      useNumberPairing({ deps, instanceId: 'n1', active: true, method: 'code', connected: false }),
    );

    await act(async () => {
      await result.current.requestPairingCode('11912345678');
    });
    expect(result.current.codePhase).toBe('error');
    expect(result.current.codeError).toMatch(/ainda não está disponível/);
  });

  it('valida o telefone antes de pedir o código', async () => {
    const deps = buildDeps();
    const { result } = renderHook(() =>
      useNumberPairing({ deps, instanceId: 'n1', active: true, method: 'code', connected: false }),
    );
    await act(async () => {
      await result.current.requestPairingCode('1234');
    });
    expect(deps.connectInstance).not.toHaveBeenCalled();
    expect(result.current.codeError).toMatch(/DDD/);
  });
});
