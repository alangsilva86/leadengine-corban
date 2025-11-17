/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Agreement } from '@/features/agreements/useConvenioCatalog.ts';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const telemetryMock = vi.fn();
const buildAgreementPayloadMock = vi.fn(() => ({ data: { id: 'payload' }, meta: {} }));

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

vi.mock('@/features/agreements/domain/buildAgreementPayload.ts', () => ({
  __esModule: true,
  buildAgreementPayload: (...args: unknown[]) => buildAgreementPayloadMock(...args),
}));

const createAgreement = (): Agreement => ({
  id: 'agreement-1',
  slug: 'agreement-1',
  nome: 'Agreement 1',
  averbadora: 'Provider',
  tipo: 'MUNICIPAL',
  status: 'ATIVO',
  produtos: [],
  responsavel: '',
  archived: false,
  metadata: {},
  janelas: [],
  taxas: [],
  history: [],
});

const createMutations = () => ({
  createAgreement: { mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'agreement-2' } }) },
  updateAgreement: { mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'agreement-1' } }) },
  upsertWindow: { mutateAsync: vi.fn() },
  removeWindow: { mutateAsync: vi.fn() },
  upsertRate: { mutateAsync: vi.fn() },
  removeRate: { mutateAsync: vi.fn() },
  importAgreements: { mutateAsync: vi.fn() },
  syncProvider: { mutateAsync: vi.fn(), isPending: false },
});

describe('useAgreementUpdateRunner', () => {
  it('updates agreements and emits telemetry events', async () => {
    const { default: useAgreementUpdateRunner } = await import('../useAgreementUpdateRunner.ts');
    const mutations = createMutations();

    const { result } = renderHook(() =>
      useAgreementUpdateRunner({
        historyAuthor: 'Admin',
        role: 'admin',
        mutations,
      })
    );

    const response = await result.current({
      nextAgreement: createAgreement(),
      toastMessage: 'Atualizado',
      telemetryEvent: 'agreements.updated',
    });

    expect(mutations.updateAgreement.mutateAsync).toHaveBeenCalledWith({
      agreementId: 'agreement-1',
      payload: { data: { id: 'payload' }, meta: {} },
    });
    expect(response).toEqual({ id: 'agreement-1' });
    expect(telemetryMock).toHaveBeenCalledWith('agreements.updated', {
      agreementId: 'agreement-1',
      role: 'admin',
    });
    expect(toastSuccess).toHaveBeenCalledWith('Atualizado');
  });

  it('creates agreements when requested', async () => {
    const { default: useAgreementUpdateRunner } = await import('../useAgreementUpdateRunner.ts');
    const mutations = createMutations();

    const { result } = renderHook(() =>
      useAgreementUpdateRunner({
        historyAuthor: 'Admin',
        role: 'admin',
        mutations,
      })
    );

    const response = await result.current({
      nextAgreement: createAgreement(),
      toastMessage: 'Criado',
      telemetryEvent: 'agreements.created',
      action: 'create',
    });

    expect(mutations.createAgreement.mutateAsync).toHaveBeenCalledWith({
      payload: { data: { id: 'payload' }, meta: {} },
    });
    expect(response).toEqual({ id: 'agreement-2' });
  });

  it('reports errors through toast notifications', async () => {
    const { default: useAgreementUpdateRunner } = await import('../useAgreementUpdateRunner.ts');
    const mutations = createMutations();
    mutations.updateAgreement.mutateAsync.mockRejectedValue(new Error('Request failed'));

    const { result } = renderHook(() =>
      useAgreementUpdateRunner({
        historyAuthor: 'Admin',
        role: 'admin',
        mutations,
      })
    );

    const response = await result.current({
      nextAgreement: createAgreement(),
      toastMessage: 'Atualizado',
      telemetryEvent: 'agreements.updated',
    });

    expect(response).toBeNull();
    expect(toastError).toHaveBeenCalledWith('Falha ao atualizar convênio');
  });
});
