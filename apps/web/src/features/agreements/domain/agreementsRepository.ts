import {
  agreementsKeys,
  deleteAgreementRate,
  deleteAgreementWindow,
  fetchAgreements,
  patchAgreement,
  postAgreement,
  postAgreementRate,
  postAgreementSync,
  postAgreementWindow,
  uploadAgreements,
} from '@/lib/agreements-client.ts';
import type { ListAgreementsResponse } from '@/lib/agreements-client.ts';
import { normalizeAgreement, type Agreement } from './normalizers.ts';

const normalizeList = (response?: ListAgreementsResponse): Agreement[] =>
  Array.isArray(response?.data) ? response.data.map(normalizeAgreement) : [];

export const agreementsRepository = {
  keys: agreementsKeys,
  list: fetchAgreements,
  normalizeList,
  create: postAgreement,
  update: patchAgreement,
  importMany: uploadAgreements,
  syncProvider: postAgreementSync,
  upsertWindow: postAgreementWindow,
  removeWindow: deleteAgreementWindow,
  upsertRate: postAgreementRate,
  removeRate: deleteAgreementRate,
};

export type { ListAgreementsResponse, UpdateAgreementResponse } from '@/lib/agreements-client.ts';
export type {
  AgreementCreateRequest,
  AgreementRateRequest,
  AgreementRateResponse,
  AgreementSyncRequest,
  AgreementWindowRequest,
  AgreementWindowResponse,
  AgreementUpdateRequest,
} from '@/lib/agreements-client.ts';
