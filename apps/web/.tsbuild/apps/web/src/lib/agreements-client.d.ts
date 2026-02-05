import type { components, paths } from '@ticketz/contracts';
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
export type AgreementCreateRequest = components['schemas']['AgreementCreateRequest'];
type AgreementAuditMetadata = AgreementUpdateRequest['meta'];
type ApiMeta = {
    generatedAt?: string;
} & Record<string, unknown>;
export type AgreementWindowRequest = {
    data: AgreementWindowDto;
    meta?: AgreementAuditMetadata;
};
export type AgreementRateRequest = {
    data: AgreementRateDto;
    meta?: AgreementAuditMetadata;
};
export type AgreementWindowResponse = {
    data: AgreementWindowDto;
    meta: ApiMeta;
};
export type AgreementRateResponse = {
    data: AgreementRateDto;
    meta: ApiMeta;
};
export type ListAgreementsResponse = paths['/api/v1/agreements']['get']['responses'][200]['content']['application/json'];
export type CreateAgreementResponse = paths['/api/v1/agreements']['post']['responses'][201]['content']['application/json'];
export type ImportAgreementsResponse = paths['/api/v1/agreements/import']['post']['responses'][202]['content']['application/json'];
export type UpdateAgreementResponse = paths['/api/v1/agreements/{agreementId}']['patch']['responses'][200]['content']['application/json'];
export type SyncAgreementResponse = paths['/api/v1/agreements/providers/{providerId}/sync']['post']['responses'][202]['content']['application/json'];
export declare const agreementsKeys: {
    all: readonly ["agreements"];
    list: () => readonly ["agreements", "list"];
    item: (agreementId: string) => readonly ["agreements", "item", string];
};
export declare const fetchAgreements: () => Promise<ListAgreementsResponse>;
export declare const postAgreement: (payload: AgreementCreateRequest) => Promise<CreateAgreementResponse>;
export declare const patchAgreement: (agreementId: string, payload: AgreementUpdateRequest) => Promise<UpdateAgreementResponse>;
export declare const postAgreementSync: (providerId: string, payload?: AgreementSyncRequest) => Promise<SyncAgreementResponse>;
export declare const uploadAgreements: (formData: FormData) => Promise<ImportAgreementsResponse>;
export declare const postAgreementWindow: (agreementId: string, payload: AgreementWindowRequest) => Promise<AgreementWindowResponse>;
export declare const deleteAgreementWindow: (agreementId: string, windowId: string, meta?: AgreementAuditMetadata) => Promise<any>;
export declare const postAgreementRate: (agreementId: string, payload: AgreementRateRequest) => Promise<AgreementRateResponse>;
export declare const deleteAgreementRate: (agreementId: string, rateId: string, meta?: AgreementAuditMetadata) => Promise<any>;
export {};
