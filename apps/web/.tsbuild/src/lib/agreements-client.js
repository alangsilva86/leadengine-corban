import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from './api.js';
export const agreementsKeys = {
    all: ['agreements'],
    list: () => [...agreementsKeys.all, 'list'],
    item: (agreementId) => [...agreementsKeys.all, 'item', agreementId],
};
export const fetchAgreements = async () => apiGet('/api/v1/agreements');
export const postAgreement = async (payload) => apiPost('/api/v1/agreements', payload);
export const patchAgreement = async (agreementId, payload) => apiPatch(`/api/v1/agreements/${agreementId}`, payload);
export const postAgreementSync = async (providerId, payload) => apiPost(`/api/v1/agreements/providers/${providerId}/sync`, payload ?? {});
export const uploadAgreements = async (formData) => apiUpload('/api/v1/agreements/import', formData);
export const postAgreementWindow = async (agreementId, payload) => apiPost(`/api/v1/agreements/${agreementId}/windows`, payload);
export const deleteAgreementWindow = async (agreementId, windowId, meta) => {
    const body = meta ? JSON.stringify({ meta }) : undefined;
    return apiDelete(`/api/v1/agreements/${agreementId}/windows/${windowId}`, body
        ? { headers: { 'Content-Type': 'application/json' }, body }
        : undefined);
};
export const postAgreementRate = async (agreementId, payload) => apiPost(`/api/v1/agreements/${agreementId}/rates`, payload);
export const deleteAgreementRate = async (agreementId, rateId, meta) => {
    const body = meta ? JSON.stringify({ meta }) : undefined;
    return apiDelete(`/api/v1/agreements/${agreementId}/rates/${rateId}`, body
        ? { headers: { 'Content-Type': 'application/json' }, body }
        : undefined);
};
