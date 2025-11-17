/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Agreement, UseConvenioCatalogReturn } from '@/features/agreements/useConvenioCatalog.ts';

const createEmptyAgreementMock = vi.fn();
const useConvenioCatalogMock = vi.fn();

vi.mock('@/features/agreements/domain/createEmptyAgreement.ts', () => ({
  __esModule: true,
  createEmptyAgreement: (...args: unknown[]) => createEmptyAgreementMock(...args),
}));

vi.mock('@/features/agreements/useConvenioCatalog.ts', () => ({
  __esModule: true,
  default: () => useConvenioCatalogMock(),
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

const createCatalogReturn = (overrides: Partial<UseConvenioCatalogReturn> = {}) => ({
  convenios: [createAgreement()],
  agreementOptions: [],
  productsByAgreement: new Map(),
  meta: null,
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
  mutations: {
    createAgreement: { mutateAsync: vi.fn() },
    updateAgreement: { mutateAsync: vi.fn() },
    upsertWindow: { mutateAsync: vi.fn() },
    removeWindow: { mutateAsync: vi.fn() },
    upsertRate: { mutateAsync: vi.fn() },
    removeRate: { mutateAsync: vi.fn() },
    importAgreements: { mutateAsync: vi.fn() },
    syncProvider: { mutateAsync: vi.fn(), isPending: false },
  },
  ...overrides,
});

describe('useAgreementSelection', () => {
  let useAgreementSelection: typeof import('../useAgreementSelection.ts').default;

  beforeEach(async () => {
    createEmptyAgreementMock.mockReset();
    useConvenioCatalogMock.mockReturnValue(createCatalogReturn());
    ({ default: useAgreementSelection } = await import('../useAgreementSelection.ts'));
  });

  it('selects the first agreement returned by the catalog', () => {
    const { result } = renderHook(() => useAgreementSelection());
    expect(result.current.state.selected?.id).toBe('agreement-1');
    expect(result.current.state.convenios).toHaveLength(1);
  });

  it('creates a pending agreement when allowed', async () => {
    const pending = createAgreement({ id: 'pending-1', metadata: {} });
    createEmptyAgreementMock.mockReturnValue(pending);

    const { result } = renderHook(() => useAgreementSelection());

    await act(async () => {
      const createdId = await result.current.actions.createConvenio();
      expect(createdId).toBe('pending-1');
    });

    expect(result.current.state.selected?.id).toBe('pending-1');
    expect(result.current.state.isCreating).toBe(true);
  });

  it('prevents creation when the user is locked', async () => {
    const { result } = renderHook(() => useAgreementSelection());

    act(() => {
      result.current.actions.setRole('seller');
    });

    await act(async () => {
      const createdId = await result.current.actions.createConvenio();
      expect(createdId).toBeNull();
    });

    expect(createEmptyAgreementMock).not.toHaveBeenCalled();
  });

  it('exposes the provider id derived from metadata', () => {
    const { result } = renderHook(() => useAgreementSelection());
    expect(result.current.state.selectedProviderId).toBe('provider-123');
  });
});
