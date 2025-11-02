/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockToDataURL } = vi.hoisted(() => ({
  mockToDataURL: vi.fn(),
}));

vi.mock('qrcode', () => ({
  toDataURL: (...args) => mockToDataURL(...args),
}));

let useQrImageSource;
let clearCache;

beforeEach(async () => {
  vi.resetModules();
  const module = await import('../useQrImageSource.js');
  useQrImageSource = module.default;
  clearCache = module.__testing.clearCache;
  clearCache();
  mockToDataURL.mockReset();
});

afterEach(() => {
  cleanup();
  clearCache?.();
  vi.clearAllMocks();
});

const resolveImmediate = (value) => ({ qrCode: value });

describe('useQrImageSource', () => {
  it('retorna o src imediato quando o payload já contém uma imagem', () => {
    const payload = { image: 'data:image/png;base64,abcdef' };

    const { result } = renderHook(() => useQrImageSource(payload));

    expect(result.current.src).toBe(payload.image);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockToDataURL).not.toHaveBeenCalled();
  });

  it('gera o QR quando necessário e reutiliza o cache em novas renderizações', async () => {
    mockToDataURL.mockResolvedValueOnce('data:image/png;base64,generated');

    const { result, rerender, unmount } = renderHook(({ payload }) => useQrImageSource(payload), {
      initialProps: { payload: resolveImmediate('CODE-123') },
    });

    expect(result.current.src).toBeNull();
    expect(result.current.isGenerating).toBe(true);

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    });

    expect(result.current.src).toBe('data:image/png;base64,generated');
    expect(mockToDataURL).toHaveBeenCalledTimes(1);
    expect(mockToDataURL).toHaveBeenCalledWith('CODE-123', expect.any(Object));

    mockToDataURL.mockClear();

    rerender({ payload: resolveImmediate('CODE-123') });

    await waitFor(() => {
      expect(result.current.src).toBe('data:image/png;base64,generated');
    });
    expect(result.current.isGenerating).toBe(false);
    expect(mockToDataURL).not.toHaveBeenCalled();

    unmount();

    const second = renderHook(() => useQrImageSource(resolveImmediate('CODE-123')));
    expect(second.result.current.src).toBe('data:image/png;base64,generated');
    expect(second.result.current.isGenerating).toBe(false);
    expect(mockToDataURL).not.toHaveBeenCalled();
    second.unmount();
  });

  it('reporta erro quando a geração falha', async () => {
    const failure = new Error('geração indisponível');
    mockToDataURL.mockRejectedValueOnce(failure);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useQrImageSource(resolveImmediate('FAILURE')));

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    });

    expect(result.current.src).toBeNull();
    expect(result.current.error).toBe(failure);
    expect(consoleSpy).toHaveBeenCalledWith('Falha ao gerar QR Code', failure);

    consoleSpy.mockRestore();
  });

  it('não tenta gerar quando o broker ainda não disponibilizou o QR', () => {
    const payload = { available: false, reason: 'UNAVAILABLE' };

    const { result } = renderHook(() => useQrImageSource(payload));

    expect(result.current.src).toBeNull();
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockToDataURL).not.toHaveBeenCalled();
  });

  it('cancela a atualização quando desmontado antes da geração concluir', async () => {
    let resolvePromise;
    mockToDataURL.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );

    const { result, unmount } = renderHook(() => useQrImageSource(resolveImmediate('CANCELLED')));
    expect(result.current.isGenerating).toBe(true);

    unmount();

    await act(async () => {
      resolvePromise('data:image/png;base64,late');
    });

    mockToDataURL.mockImplementationOnce(() => Promise.resolve('data:image/png;base64,final'));

    const next = renderHook(() => useQrImageSource(resolveImmediate('CANCELLED')));

    expect(mockToDataURL).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(next.result.current.isGenerating).toBe(false);
    });

    expect(next.result.current.src).toBe('data:image/png;base64,final');
    expect(next.result.current.error).toBeNull();
    next.unmount();
  });
});
