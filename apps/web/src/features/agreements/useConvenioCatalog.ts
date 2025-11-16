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

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readMetadataString = (metadata: Record<string, unknown>, key: string): string => {
  const value = metadata[key];
  return typeof value === 'string' ? value : '';
};

const normalizeProducts = (
  products: Record<string, unknown>,
  metadata: Record<string, unknown>
): string[] => {
  if (Array.isArray(metadata.products)) {
    return metadata.products.filter((item): item is string => typeof item === 'string');
  }

  return Object.keys(products ?? {});
};

export type AgreementWindow = {
  id: string;
  tableId: string | null;
  label: string;
  start: Date;
  end: Date;
  firstDueDate: Date;
  isActive: boolean;
  metadata: Record<string, unknown>;
};

export type AgreementRate = {
  id: string;
  tableId: string | null;
  windowId: string | null;
  product: string;
  modality: string;
  termMonths: number | null;
  coefficient: number | null;
  monthlyRate: number | null;
  annualRate: number | null;
  tacPercentage: number | null;
  metadata: Record<string, unknown>;
  validFrom: Date;
  validUntil: NullableDate;
};

export type AgreementHistoryEntry = {
  id: string;
  author: string;
  message: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type Agreement = {
  id: string;
  slug: string;
  nome: string;
  averbadora: string;
  tipo: string | null;
  status: string;
  produtos: string[];
  responsavel: string;
  archived: boolean;
  metadata: Record<string, unknown>;
  janelas: AgreementWindow[];
  taxas: AgreementRate[];
  history: AgreementHistoryEntry[];
};

const normalizeWindow = (window: AgreementWindowDto): AgreementWindow => {
  const metadata = toRecord(window.metadata);
  const firstDueDate =
    typeof metadata.firstDueDate === 'string'
      ? metadata.firstDueDate
      : window.startsAt ?? window.endsAt ?? null;
  return {
    id: window.id,
    tableId: window.tableId ?? null,
    label: window.label,
    start: ensureDate(window.startsAt ?? null),
    end: ensureDate(window.endsAt ?? null),
    firstDueDate: ensureDate(firstDueDate),
    isActive: Boolean(window.isActive),
    metadata,
  };
};

const normalizeRate = (rate: AgreementRateDto): AgreementRate => {
  const metadata = toRecord(rate.metadata);
  return {
    id: rate.id,
    tableId: rate.tableId ?? null,
    windowId: rate.windowId ?? null,
    product: rate.product,
    modality: rate.modality,
    termMonths: typeof rate.termMonths === 'number' ? rate.termMonths : null,
    coefficient: typeof rate.coefficient === 'number' ? rate.coefficient : null,
    monthlyRate: typeof rate.monthlyRate === 'number' ? rate.monthlyRate : null,
    annualRate: typeof rate.annualRate === 'number' ? rate.annualRate : null,
    tacPercentage: typeof rate.tacPercentage === 'number' ? rate.tacPercentage : null,
    metadata,
    validFrom: ensureDate((metadata.validFrom as string | undefined) ?? null),
    validUntil: parseDate((metadata.validUntil as string | undefined) ?? null),
  };
};

const normalizeHistoryEntry = (entry: AgreementHistoryEntryDto): AgreementHistoryEntry => ({
  id: entry.id,
  author: entry.actorName ?? entry.actorId ?? 'Sistema',
  message: entry.message,
  createdAt: ensureDate(entry.createdAt ?? null),
  metadata: toRecord(entry.metadata),
});

const normalizeAgreement = (agreement: AgreementDto): Agreement => {
  const metadata = toRecord(agreement.metadata);
  return {
    id: agreement.id,
    slug: agreement.slug,
    nome: agreement.name,
    averbadora: readMetadataString(metadata, 'providerName') || agreement.slug,
    tipo: agreement.type ?? null,
    status: agreement.status,
    produtos: normalizeProducts(toRecord(agreement.products), metadata),
    responsavel: readMetadataString(metadata, 'responsavel'),
    archived: Boolean(agreement.archived),
    metadata,
    janelas: Array.isArray(agreement.windows) ? agreement.windows.map(normalizeWindow) : [],
    taxas: Array.isArray(agreement.rates) ? agreement.rates.map(normalizeRate) : [],
    history: Array.isArray((agreement as { history?: AgreementHistoryEntryDto[] }).history)
      ? ((agreement as { history?: AgreementHistoryEntryDto[] }).history ?? []).map(normalizeHistoryEntry)
      : [],
  };
};

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const mapProductsToRecord = (products: string[]): Record<string, unknown> =>
  products.reduce<Record<string, unknown>>((acc, product) => {
    acc[product] = true;
    return acc;
  }, {});

export const serializeAgreement = (agreement: Agreement): AgreementUpdateRequest['data'] => ({
  name: agreement.nome,
  slug: agreement.slug || slugify(agreement.nome),
  status: agreement.status,
  type: agreement.tipo ?? undefined,
  metadata: {
    ...agreement.metadata,
    providerName: agreement.averbadora,
    responsavel: agreement.responsavel,
    products: agreement.produtos,
  },
  products: mapProductsToRecord(agreement.produtos),
  archived: agreement.archived,
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
