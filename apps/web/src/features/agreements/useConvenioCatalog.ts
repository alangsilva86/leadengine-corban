import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AgreementDto,
  AgreementHistoryEntryDto,
  AgreementRateDto,
  AgreementUpdateRequest,
  AgreementWindowDto,
  ListAgreementsResponse,
  UpdateAgreementResponse,
} from '@/lib/agreements-client.ts';
import {
  agreementsKeys,
  fetchAgreements,
  patchAgreement,
  postAgreementSync,
  uploadAgreements,
} from '@/lib/agreements-client.ts';

type NullableDate = Date | null;

const parseDate = (value?: string | null): NullableDate => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const ensureDate = (value?: string | null): Date => {
  const parsed = parseDate(value);
  return parsed ?? new Date();
};

export type AgreementWindow = Omit<AgreementWindowDto, 'start' | 'end' | 'firstDueDate'> & {
  start: Date;
  end: Date;
  firstDueDate: Date;
};

export type AgreementRate = Omit<AgreementRateDto, 'validFrom' | 'validUntil'> & {
  validFrom: Date;
  validUntil: NullableDate;
};

export type AgreementHistoryEntry = Omit<AgreementHistoryEntryDto, 'createdAt'> & {
  createdAt: Date;
};

export type Agreement = Omit<AgreementDto, 'janelas' | 'taxas' | 'history'> & {
  janelas: AgreementWindow[];
  taxas: AgreementRate[];
  history: AgreementHistoryEntry[];
};

const normalizeWindow = (window: AgreementWindowDto): AgreementWindow => ({
  ...window,
  start: ensureDate(window.start),
  end: ensureDate(window.end),
  firstDueDate: ensureDate(window.firstDueDate),
});

const normalizeRate = (rate: AgreementRateDto): AgreementRate => ({
  ...rate,
  validFrom: ensureDate(rate.validFrom),
  validUntil: rate.validUntil ? parseDate(rate.validUntil) : null,
});

const normalizeHistoryEntry = (entry: AgreementHistoryEntryDto): AgreementHistoryEntry => ({
  ...entry,
  createdAt: ensureDate(entry.createdAt ?? undefined),
});

const normalizeAgreement = (agreement: AgreementDto): Agreement => ({
  ...agreement,
  produtos: Array.isArray(agreement.produtos) ? agreement.produtos : [],
  janelas: Array.isArray(agreement.janelas) ? agreement.janelas.map(normalizeWindow) : [],
  taxas: Array.isArray(agreement.taxas) ? agreement.taxas.map(normalizeRate) : [],
  history: Array.isArray(agreement.history) ? agreement.history.map(normalizeHistoryEntry) : [],
  archived: Boolean(agreement.archived),
});

const toDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const serializeWindow = (window: AgreementWindow): AgreementWindowDto => ({
  ...window,
  start: toDateString(window.start),
  end: toDateString(window.end),
  firstDueDate: toDateString(window.firstDueDate),
});

export const serializeRate = (rate: AgreementRate): AgreementRateDto => ({
  ...rate,
  validFrom: toDateString(rate.validFrom),
  validUntil: rate.validUntil ? toDateString(rate.validUntil) : null,
});

export const serializeAgreement = (agreement: Agreement): AgreementUpdateRequest['data'] => ({
  nome: agreement.nome,
  averbadora: agreement.averbadora,
  tipo: agreement.tipo,
  status: agreement.status,
  produtos: agreement.produtos,
  responsavel: agreement.responsavel,
  archived: agreement.archived,
  janelas: agreement.janelas.map(serializeWindow),
  taxas: agreement.taxas.map(serializeRate),
  history: agreement.history.map((entry) => ({
    ...entry,
    createdAt: entry.createdAt.toISOString(),
  })),
});

type UpdateAgreementVariables = {
  agreementId: string;
  payload: AgreementUpdateRequest;
};

type SyncAgreementVariables = {
  providerId: string;
  payload?: Parameters<typeof postAgreementSync>[1];
};

type ImportAgreementsVariables = {
  formData: FormData;
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
  if (index === -1) {
    return {
      data: [agreement, ...items],
      meta: {
        fetchedAt: meta?.updatedAt ?? current.meta?.fetchedAt ?? new Date().toISOString(),
      },
    } satisfies ListAgreementsResponse;
  }

  items[index] = agreement;
  return {
    ...current,
    data: items,
    meta: {
      fetchedAt: meta?.updatedAt ?? current.meta?.fetchedAt ?? new Date().toISOString(),
    },
  } satisfies ListAgreementsResponse;
};

const useConvenioCatalog = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: agreementsKeys.list(),
    queryFn: fetchAgreements,
  });

  const convenios = useMemo(
    () => (Array.isArray(query.data?.data) ? query.data.data.map(normalizeAgreement) : []),
    [query.data?.data]
  );

  const updateAgreementMutation = useMutation({
    mutationFn: ({ agreementId, payload }: UpdateAgreementVariables) => patchAgreement(agreementId, payload),
    onSuccess: (response) => {
      if (!response?.data) {
        return;
      }

      queryClient.setQueryData<ListAgreementsResponse>(agreementsKeys.list(), (current) =>
        updateListWithAgreement(current, response.data, response.meta)
      );
    },
  });

  const importMutation = useMutation({
    mutationFn: ({ formData }: ImportAgreementsVariables) => uploadAgreements(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agreementsKeys.list() });
    },
  });

  const syncMutation = useMutation({
    mutationFn: ({ providerId, payload }: SyncAgreementVariables) => postAgreementSync(providerId, payload),
  });

  return {
    convenios,
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
    mutations: {
      updateAgreement: updateAgreementMutation,
      importAgreements: importMutation,
      syncProvider: syncMutation,
    },
  } as const;
};

export default useConvenioCatalog;
