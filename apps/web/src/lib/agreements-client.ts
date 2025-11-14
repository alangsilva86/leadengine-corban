import type { components, paths } from '@ticketz/contracts';
import { apiGet, apiPatch, apiPost, apiUpload } from './api.js';

export type AgreementDto = components['schemas']['Agreement'];
export type AgreementWindowDto = components['schemas']['AgreementWindow'];
export type AgreementRateDto = components['schemas']['AgreementRate'];
export type AgreementHistoryEntryDto = components['schemas']['AgreementHistoryEntry'];
export type AgreementCollectionResponse = components['schemas']['AgreementCollectionResponse'];
export type AgreementItemResponse = components['schemas']['AgreementItemResponse'];
export type AgreementImportResponse = components['schemas']['AgreementImportResponse'];
export type AgreementImportErrorResponse = components['schemas']['AgreementImportErrorResponse'];
export type AgreementSyncResponse = components['schemas']['AgreementSyncResponse'];
export type AgreementUpdateRequest = components['schemas']['AgreementUpdateRequest'];
export type AgreementSyncRequest = components['schemas']['AgreementSyncRequest'];

export type ListAgreementsResponse =
  paths['/api/v1/agreements']['get']['responses'][200]['content']['application/json'];

export type ImportAgreementsResponse =
  paths['/api/v1/agreements/import']['post']['responses'][202]['content']['application/json'];

export type UpdateAgreementResponse =
  paths['/api/v1/agreements/{agreementId}']['patch']['responses'][200]['content']['application/json'];

export type SyncAgreementResponse =
  paths['/api/v1/agreements/providers/{providerId}/sync']['post']['responses'][202]['content']['application/json'];

export const agreementsKeys = {
  all: ['agreements'] as const,
  list: () => [...agreementsKeys.all, 'list'] as const,
  item: (agreementId: string) => [...agreementsKeys.all, 'item', agreementId] as const,
};

export const fetchAgreements = async (): Promise<ListAgreementsResponse> =>
  apiGet('/api/v1/agreements');

export const patchAgreement = async (
  agreementId: string,
  payload: AgreementUpdateRequest
): Promise<UpdateAgreementResponse> => apiPatch(`/api/v1/agreements/${agreementId}`, payload);

export const postAgreementSync = async (
  providerId: string,
  payload?: AgreementSyncRequest
): Promise<SyncAgreementResponse> => apiPost(`/api/v1/agreements/providers/${providerId}/sync`, payload ?? {});

export const uploadAgreements = async (formData: FormData): Promise<ImportAgreementsResponse> =>
  apiUpload('/api/v1/agreements/import', formData);
