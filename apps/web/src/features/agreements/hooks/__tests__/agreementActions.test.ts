/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseMutationResult } from '@tanstack/react-query';

import type { Agreement, UseConvenioCatalogReturn } from '@/features/agreements/useConvenioCatalog';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const telemetryMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('@/features/agreements/utils/telemetry', () => ({
  __esModule: true,
  default: (...args: unknown[]) => telemetryMock(...args),
}));

const createMutationMock = <TData = any, TVariables = any>(): UseMutationResult<TData, Error, TVariables, unknown> => ({
  mutateAsync: vi.fn(),
  mutate: vi.fn(),
  data: undefined as TData | undefined,
  error: null,
  variables: undefined,
  isError: false,
  isIdle: true,
  isPending: false,
  isSuccess: false,
  status: 'idle',
  reset: vi.fn(),
  failureCount: 0,
  failureReason: null,
  isPaused: false,
  context: undefined,
});

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
const upsertRateMutation = createMutationMock();

const createMutations = (): UseConvenioCatalogReturn['mutations'] => ({
  createAgreement: createMutationMock(),
  updateAgreement: createMutationMock(),
  upsertWindow: createMutationMock(),
  removeWindow: createMutationMock(),
  upsertRate: createMutationMock(),
  removeRate: createMutationMock(),
  importAgreements: createMutationMock(),
  syncProvider: createMutationMock(),
});

describe('agreement action hooks', () => {
  beforeEach(() => {
    buildHistoryEntry.mockClear();
    runUpdateMock.mockReset();
    upsertRateMutation.mutateAsync.mockReset();
    upsertRateMutation.mutate.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    telemetryMock.mockReset();
  });

  describe('useAgreementBasicActions', () => {
    it('updates agreement basic data and records history', async () => {
      const selected = createAgreement();
      const { default: useAgreementBasicActions } = await import('../useAgreementBasicActions');
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
      const { default: useAgreementBasicActions } = await import('../useAgreementBasicActions');
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
    it('upserts agreement windows according to the dialog intent and removes entries when requested', async () => {
      const baseWindow = {
        id: 'window-1',
        label: 'Janeiro',
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        firstDueDate: new Date('2024-02-10'),
      } as const;

      const upsertWindowMutation = createMutationMock();
      upsertWindowMutation.mutateAsync = vi.fn().mockResolvedValue(null);
      const removeWindowMutation = createMutationMock();
      removeWindowMutation.mutateAsync = vi.fn().mockResolvedValue(null);
      const mutations = {
        ...createMutations(),
        upsertWindow: upsertWindowMutation,
        removeWindow: removeWindowMutation,
      };
      const { default: useAgreementWindowActions } = await import('../useAgreementWindowActions');

      const initialAgreement = createAgreement({ janelas: [] });

      const { result, rerender } = renderHook(
        (props: Parameters<typeof useAgreementWindowActions>[0]) => useAgreementWindowActions(props),
        {
          initialProps: {
            selected: initialAgreement,
            locked: false,
            buildHistoryEntry,
            historyAuthor: 'Admin',
            role: 'admin',
            mutations,
          },
        }
      );

      await act(async () => {
        await result.current.upsertWindow({ ...baseWindow, mode: 'create' });
      });

      const createCall = upsertWindowMutation.mutateAsync.mock.calls[0]?.[0];
      expect(createCall?.payload?.data).not.toHaveProperty('id');

      const agreementWithWindow = createAgreement({
        janelas: [
          {
            ...baseWindow,
            tableId: null,
            isActive: true,
            metadata: {},
          },
        ],
      });

      rerender({
        selected: agreementWithWindow,
        locked: false,
        buildHistoryEntry,
        historyAuthor: 'Admin',
        role: 'admin',
        mutations,
      });

      await act(async () => {
        await result.current.upsertWindow({ ...baseWindow, mode: 'update' });
      });

      const updateCall = upsertWindowMutation.mutateAsync.mock.calls.at(-1)?.[0];
      expect(updateCall?.payload?.data?.id).toBe('window-1');

      await act(async () => {
        await result.current.removeWindow('window-1');
      });

      expect(removeWindowMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ agreementId: agreementWithWindow.id, windowId: 'window-1' })
      );
    });
  });

  describe('useAgreementRateActions', () => {
    it('upserts rate entries', async () => {
      const selected = createAgreement({ taxas: [] });
      const { default: useAgreementRateActions } = await import('../useAgreementRateActions');
      upsertRateMutation.mutateAsync.mockResolvedValue({
        data: {
          id: 'tax-1',
          product: 'Produto A',
          modality: 'Modalidade A',
          monthlyRate: 2.5,
          metadata: {},
        },
        meta: {},
      } as unknown as UseConvenioCatalogReturn['mutations']['upsertRate']);

      const { result } = renderHook(() =>
        useAgreementRateActions({
          selected,
          locked: false,
          buildHistoryEntry,
          historyAuthor: 'Alice',
          role: 'admin',
          mutations: { ...createMutations(), upsertRate: upsertRateMutation },
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

      expect(upsertRateMutation.mutateAsync).toHaveBeenCalled();
      const call = upsertRateMutation.mutateAsync.mock.calls[0]?.[0];
      expect(call).toMatchObject({
        agreementId: selected.id,
      });
      expect(call?.payload?.data).toMatchObject({
        product: taxPayload.produto,
        modality: taxPayload.modalidade,
        monthlyRate: taxPayload.monthlyRate,
      });
      expect(call?.payload?.data).not.toHaveProperty('id');
      expect(telemetryMock).toHaveBeenCalledWith('agreements.rate.upserted', expect.any(Object));
      expect(toastSuccess).toHaveBeenCalledWith('Taxa salva com sucesso');
    });
  });

  describe('useAgreementLifecycleActions', () => {
    it('archives agreements when allowed', async () => {
      const agreements = [createAgreement()];
      const { default: useAgreementLifecycleActions } = await import('../useAgreementLifecycleActions');
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
      const { default: useAgreementProviderActions } = await import('../useAgreementProviderActions');
      const mutations = { ...createMutations(), syncProvider: createMutationMock() };
      mutations.syncProvider.mutateAsync = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useAgreementProviderActions({
          selected: createAgreement(),
          locked: false,
          role: 'admin',
          mutations,
        })
      );

      await act(async () => {
        await result.current.syncProvider();
      });

      expect(mutations.syncProvider.mutateAsync).toHaveBeenCalledWith({
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
      const { default: useAgreementProviderActions } = await import('../useAgreementProviderActions');
      const mutations = { ...createMutations(), syncProvider: createMutationMock() };
      mutations.syncProvider.mutateAsync = vi.fn();
      const { result } = renderHook(() =>
        useAgreementProviderActions({
          selected: createAgreement({ metadata: {} }),
          locked: false,
          role: 'admin',
          mutations,
        })
      );

      await act(async () => {
        await result.current.syncProvider();
      });

      expect(mutations.syncProvider.mutateAsync).not.toHaveBeenCalled();
      expect(toastError).toHaveBeenCalledWith('Sincronização disponível apenas para convênios integrados.');
    });
  });
});
