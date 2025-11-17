import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProductsByAgreement,
  toAgreementOptions,
  type AgreementOption,
  type AgreementProductOption,
} from './agreementsSelectors.ts';
import type { AgreementDto } from '@/lib/agreements-client.ts';
import {
  agreementsRepository,
  type AgreementCreateRequest,
  type AgreementRateRequest,
  type AgreementRateResponse,
  type AgreementSyncRequest,
  type AgreementUpdateRequest,
  type AgreementWindowRequest,
  type AgreementWindowResponse,
  type ListAgreementsResponse,
  type UpdateAgreementResponse,
} from './domain/agreementsRepository.ts';

type UpdateAgreementVariables = {
  agreementId: string;
  payload: AgreementUpdateRequest;
};

type CreateAgreementVariables = {
  payload: AgreementCreateRequest;
};

type SyncAgreementVariables = {
  providerId: string;
  payload?: AgreementSyncRequest;
};

type ImportAgreementsVariables = {
  formData: FormData;
};

type UpsertWindowVariables = {
  agreementId: string;
  payload: AgreementWindowRequest;
};

type RemoveWindowVariables = {
  agreementId: string;
  windowId: string;
  meta?: AgreementUpdateRequest['meta'];
};

type UpsertRateVariables = {
  agreementId: string;
  payload: AgreementRateRequest;
};

type RemoveRateVariables = {
  agreementId: string;
  rateId: string;
  meta?: AgreementUpdateRequest['meta'];
};

const updateListWithAgreement = (
  current: ListAgreementsResponse | undefined,
  agreement: AgreementDto,
  meta?: UpdateAgreementResponse['meta']
): ListAgreementsResponse | undefined => {
  if (!current) {
    return current;
  }

  const items = Array.isArray(current.data) ? [...current.data] : [];
  const index = items.findIndex((item) => item.id === agreement.id);
  const nextGeneratedAt = meta?.updatedAt ?? current.meta?.generatedAt ?? new Date().toISOString();
  const baseMeta = { ...(current.meta ?? {}) };
  if (index === -1) {
    return {
      data: [agreement, ...items],
      meta: {
        ...baseMeta,
        generatedAt: nextGeneratedAt,
      },
    } satisfies ListAgreementsResponse;
  }

  items[index] = agreement;
  return {
    ...current,
    data: items,
    meta: {
      ...baseMeta,
      generatedAt: nextGeneratedAt,
    },
  } satisfies ListAgreementsResponse;
};

const updateAgreementPartial = (
  current: ListAgreementsResponse | undefined,
  agreementId: string,
  updater: (agreement: AgreementDto) => AgreementDto,
  generatedAt?: string
): ListAgreementsResponse | undefined => {
  if (!current || !Array.isArray(current.data)) {
    return current;
  }

  const index = current.data.findIndex((item) => item.id === agreementId);
  if (index === -1) {
    return current;
  }

  const items = [...current.data];
  const updatedAgreement = updater(items[index]);
  items[index] = updatedAgreement;

  return {
    ...current,
    data: items,
    meta: {
      ...(current.meta ?? {}),
      generatedAt: generatedAt ?? current.meta?.generatedAt ?? new Date().toISOString(),
    },
  } satisfies ListAgreementsResponse;
};

const useConvenioCatalog = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: agreementsRepository.keys.list(),
    queryFn: agreementsRepository.list,
  });

  const convenios = useMemo(
    () => agreementsRepository.normalizeList(query.data),
    [query.data]
  );

  const agreementOptions = useMemo(() => toAgreementOptions(convenios), [convenios]);
  const productsByAgreement = useMemo(
    () => getProductsByAgreement(agreementOptions),
    [agreementOptions]
  );

  const updateAgreementMutation = useMutation({
    mutationFn: ({ agreementId, payload }: UpdateAgreementVariables) =>
      agreementsRepository.update(agreementId, payload),
    onSuccess: (response) => {
      if (!response?.data) {
        return;
      }

      queryClient.setQueryData<ListAgreementsResponse>(agreementsRepository.keys.list(), (current) =>
        updateListWithAgreement(current, response.data, response.meta)
      );
    },
  });

  const createAgreementMutation = useMutation({
    mutationFn: ({ payload }: CreateAgreementVariables) => agreementsRepository.create(payload),
    onSuccess: (response) => {
      if (!response?.data) {
        return;
      }

      queryClient.setQueryData<ListAgreementsResponse>(agreementsRepository.keys.list(), (current) =>
        updateListWithAgreement(current, response.data, response.meta)
      );
    },
  });

  const importMutation = useMutation({
    mutationFn: ({ formData }: ImportAgreementsVariables) => agreementsRepository.importMany(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agreementsRepository.keys.list() });
    },
  });

  const syncMutation = useMutation({
    mutationFn: ({ providerId, payload }: SyncAgreementVariables) =>
      agreementsRepository.syncProvider(providerId, payload),
  });

  const upsertWindowMutation = useMutation({
    mutationFn: ({ agreementId, payload }: UpsertWindowVariables) =>
      agreementsRepository.upsertWindow(agreementId, payload),
    onSuccess: (response: AgreementWindowResponse | undefined, variables) => {
      if (!response?.data) {
        queryClient.invalidateQueries({ queryKey: agreementsRepository.keys.list() });
        return;
      }

      queryClient.setQueryData<ListAgreementsResponse>(agreementsRepository.keys.list(), (current) =>
        updateAgreementPartial(
          current,
          variables.agreementId,
          (agreement) => {
            const windows = Array.isArray(agreement.windows) ? [...agreement.windows] : [];
            const index = windows.findIndex((item) => item.id === response.data.id);
            if (index === -1) {
              windows.push(response.data);
            } else {
              windows[index] = response.data;
            }
            return { ...agreement, windows } satisfies AgreementDto;
          },
          response.meta?.generatedAt as string | undefined
        )
      );
    },
  });

  const removeWindowMutation = useMutation({
    mutationFn: ({ agreementId, windowId, meta }: RemoveWindowVariables) =>
      agreementsRepository.removeWindow(agreementId, windowId, meta),
    onSuccess: (_response, variables) => {
      queryClient.setQueryData<ListAgreementsResponse>(agreementsRepository.keys.list(), (current) =>
        updateAgreementPartial(current, variables.agreementId, (agreement) => ({
          ...agreement,
          windows: Array.isArray(agreement.windows)
            ? agreement.windows.filter((window) => window.id !== variables.windowId)
            : [],
        }))
      );
    },
  });

  const upsertRateMutation = useMutation({
    mutationFn: ({ agreementId, payload }: UpsertRateVariables) =>
      agreementsRepository.upsertRate(agreementId, payload),
    onSuccess: (response: AgreementRateResponse | undefined, variables) => {
      if (!response?.data) {
        queryClient.invalidateQueries({ queryKey: agreementsRepository.keys.list() });
        return;
      }

      queryClient.setQueryData<ListAgreementsResponse>(agreementsRepository.keys.list(), (current) =>
        updateAgreementPartial(
          current,
          variables.agreementId,
          (agreement) => {
            const rates = Array.isArray(agreement.rates) ? [...agreement.rates] : [];
            const index = rates.findIndex((item) => item.id === response.data.id);
            if (index === -1) {
              rates.push(response.data);
            } else {
              rates[index] = response.data;
            }
            return { ...agreement, rates } satisfies AgreementDto;
          },
          response.meta?.generatedAt as string | undefined
        )
      );
    },
  });

  const removeRateMutation = useMutation({
    mutationFn: ({ agreementId, rateId, meta }: RemoveRateVariables) =>
      agreementsRepository.removeRate(agreementId, rateId, meta),
    onSuccess: (_response, variables) => {
      queryClient.setQueryData<ListAgreementsResponse>(agreementsRepository.keys.list(), (current) =>
        updateAgreementPartial(current, variables.agreementId, (agreement) => ({
          ...agreement,
          rates: Array.isArray(agreement.rates)
            ? agreement.rates.filter((rate) => rate.id !== variables.rateId)
            : [],
        }))
      );
    },
  });

  return {
    convenios,
    agreementOptions,
    productsByAgreement,
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
    mutations: {
      createAgreement: createAgreementMutation,
      updateAgreement: updateAgreementMutation,
      upsertWindow: upsertWindowMutation,
      removeWindow: removeWindowMutation,
      upsertRate: upsertRateMutation,
      removeRate: removeRateMutation,
      importAgreements: importMutation,
      syncProvider: syncMutation,
    },
  } as const;
};

export type UseConvenioCatalogReturn = ReturnType<typeof useConvenioCatalog>;

export const useAgreementOptions = (): AgreementOption[] => {
  const { agreementOptions } = useConvenioCatalog();
  return agreementOptions;
};

export const useAgreementProducts = (): Map<string, AgreementProductOption[]> => {
  const { productsByAgreement } = useConvenioCatalog();
  return productsByAgreement;
};

export type { Agreement, AgreementHistoryEntry, AgreementRate, AgreementWindow } from './domain/normalizers.ts';
export { serializeAgreement } from './domain/normalizers.ts';

export default useConvenioCatalog;
