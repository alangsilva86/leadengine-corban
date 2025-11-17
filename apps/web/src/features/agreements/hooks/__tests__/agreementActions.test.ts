/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Agreement } from '@/features/agreements/useConvenioCatalog.ts';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const telemetryMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('@/features/agreements/utils/telemetry.ts', () => ({
  __esModule: true,
  default: (...args: unknown[]) => telemetryMock(...args),
}));

const createAgreement = (overrides: Partial<Agreement> = {}): Agreement => ({
  id: 'agreement-1',
  slug: 'agreement-1',
  nome: 'Agreement 1',
  averbadora: 'Provider',
  tipo: 'MUNICIPAL',
  status: 'ATIVO',
  produtos: [],
  responsavel: '',
  archived: false,
  metadata: { providerId: 'provider-123' },
  janelas: [],
  taxas: [],
  history: [],
  ...overrides,
});

const createHistoryEntry = (message: string) => ({
  id: `history-${Math.random()}`,
  author: 'Admin',
  message,
  createdAt: new Date(),
  metadata: {},
});

const buildHistoryEntry = vi.fn((message: string) => createHistoryEntry(message));
const runUpdateMock = vi.fn();

describe('agreement action hooks', () => {
  beforeEach(() => {
    buildHistoryEntry.mockClear();
    runUpdateMock.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    telemetryMock.mockReset();
  });

  describe('useAgreementBasicActions', () => {
    it('updates agreement basic data and records history', async () => {
      const selected = createAgreement();
      const { default: useAgreementBasicActions } = await import('../useAgreementBasicActions.ts');
      runUpdateMock.mockResolvedValue({ id: 'agreement-1' });

      const { result } = renderHook(() =>
        useAgreementBasicActions({
          selected,
          locked: false,
          pendingAgreement: null,
          setPendingAgreement: vi.fn(),
          setSelectedId: vi.fn(),
          runUpdate: runUpdateMock,
          buildHistoryEntry,
        })
      );

      await act(async () => {
        await result.current.updateBasic({
          nome: 'Agreement X',
          averbadora: 'Provider',
          tipo: 'MUNICIPAL',
          status: 'ATIVO',
          produtos: [],
          responsavel: 'Alice',
        });
      });

      expect(runUpdateMock).toHaveBeenCalledTimes(1);
      expect(buildHistoryEntry).toHaveBeenCalledWith(expect.stringContaining('Agreement X'));
    });

    it('handles creation flow and resets pending agreement', async () => {
      const selected = createAgreement();
      const { default: useAgreementBasicActions } = await import('../useAgreementBasicActions.ts');
      const setPending = vi.fn();
      const setSelectedId = vi.fn();
      runUpdateMock.mockResolvedValue({ id: 'agreement-2' });

      const { result } = renderHook(() =>
        useAgreementBasicActions({
          selected,
          locked: false,
          pendingAgreement: selected,
          setPendingAgreement: setPending,
          setSelectedId,
          runUpdate: runUpdateMock,
          buildHistoryEntry,
        })
      );

      await act(async () => {
        await result.current.updateBasic({
          nome: 'Agreement Y',
          averbadora: 'Provider',
          tipo: 'MUNICIPAL',
          status: 'ATIVO',
          produtos: [],
          responsavel: 'Bob',
        });
      });

      expect(setPending).toHaveBeenCalledWith(null);
      expect(setSelectedId).toHaveBeenCalledWith('agreement-2');
    });
  });

  describe('useAgreementWindowActions', () => {
    it('upserts and removes agreement windows', async () => {
      const selected = createAgreement({ janelas: [] });
      const { default: useAgreementWindowActions } = await import('../useAgreementWindowActions.ts');
      runUpdateMock.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useAgreementWindowActions({
          selected,
          locked: false,
          runUpdate: runUpdateMock,
          buildHistoryEntry,
        })
      );

      const windowPayload = {
        id: 'window-1',
        label: 'Janeiro',
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        firstDueDate: new Date('2024-02-10'),
      } satisfies Parameters<typeof result.current.upsertWindow>[0];

      await act(async () => {
        await result.current.upsertWindow(windowPayload);
      });

      expect(runUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          nextAgreement: expect.objectContaining({ janelas: [windowPayload] }),
        })
      );

      await act(async () => {
        await result.current.removeWindow('window-1');
      });

      expect(runUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          telemetryEvent: 'agreements.window.removed',
        })
      );
    });
  });

  describe('useAgreementRateActions', () => {
    it('upserts rate entries', async () => {
      const selected = createAgreement({ taxas: [] });
      const { default: useAgreementRateActions } = await import('../useAgreementRateActions.ts');
      runUpdateMock.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useAgreementRateActions({
          selected,
          locked: false,
          runUpdate: runUpdateMock,
          buildHistoryEntry,
        })
      );

      const taxPayload = {
        id: 'tax-1',
        produto: 'Produto A',
        modalidade: 'Modalidade A',
        monthlyRate: 2.5,
        tacPercent: 0,
        tacFlat: 0,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
      } satisfies Parameters<typeof result.current.upsertTax>[0];

      await act(async () => {
        await result.current.upsertTax(taxPayload);
      });

      expect(runUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          telemetryEvent: 'agreements.rate.upserted',
        })
      );
    });
  });

  describe('useAgreementLifecycleActions', () => {
    it('archives agreements when allowed', async () => {
      const agreements = [createAgreement()];
      const { default: useAgreementLifecycleActions } = await import('../useAgreementLifecycleActions.ts');
      runUpdateMock.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useAgreementLifecycleActions({
          convenios: agreements,
          locked: false,
          runUpdate: runUpdateMock,
          buildHistoryEntry,
        })
      );

      await act(async () => {
        await result.current.archiveConvenio('agreement-1');
      });

      expect(runUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          telemetryEvent: 'agreements.archived',
        })
      );
    });
  });

  describe('useAgreementProviderActions', () => {
    it('syncs provider data when possible', async () => {
      const { default: useAgreementProviderActions } = await import('../useAgreementProviderActions.ts');
      const mutateAsync = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useAgreementProviderActions({
          selected: createAgreement(),
          locked: false,
          role: 'admin',
          mutations: {
            createAgreement: { mutateAsync: vi.fn() },
            updateAgreement: { mutateAsync: vi.fn() },
            upsertWindow: { mutateAsync: vi.fn() },
            removeWindow: { mutateAsync: vi.fn() },
            upsertRate: { mutateAsync: vi.fn() },
            removeRate: { mutateAsync: vi.fn() },
            importAgreements: { mutateAsync: vi.fn() },
            syncProvider: { mutateAsync, isPending: false },
          },
        })
      );

      await act(async () => {
        await result.current.syncProvider();
      });

      expect(mutateAsync).toHaveBeenCalledWith({
        providerId: 'provider-123',
        payload: { requestedBy: 'admin', reason: 'manual-trigger' },
      });
      expect(toastSuccess).toHaveBeenCalledWith('Sincronização enviada para processamento');
      expect(telemetryMock).toHaveBeenCalledWith('agreements.sync.triggered', {
        agreementId: 'agreement-1',
        providerId: 'provider-123',
        role: 'admin',
      });
    });

    it('guards against missing provider ids', async () => {
      const { default: useAgreementProviderActions } = await import('../useAgreementProviderActions.ts');
      const mutateAsync = vi.fn();
      const { result } = renderHook(() =>
        useAgreementProviderActions({
          selected: createAgreement({ metadata: {} }),
          locked: false,
          role: 'admin',
          mutations: {
            createAgreement: { mutateAsync: vi.fn() },
            updateAgreement: { mutateAsync: vi.fn() },
            upsertWindow: { mutateAsync: vi.fn() },
            removeWindow: { mutateAsync: vi.fn() },
            upsertRate: { mutateAsync: vi.fn() },
            removeRate: { mutateAsync: vi.fn() },
            importAgreements: { mutateAsync: vi.fn() },
            syncProvider: { mutateAsync, isPending: false },
          },
        })
      );

      await act(async () => {
        await result.current.syncProvider();
      });

      expect(mutateAsync).not.toHaveBeenCalled();
      expect(toastError).toHaveBeenCalledWith('Sincronização disponível apenas para convênios integrados.');
    });
  });
});
