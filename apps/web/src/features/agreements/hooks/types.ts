import type { Agreement, AgreementHistoryEntry } from '@/features/agreements/useConvenioCatalog.ts';

export type UpdateBasicPayload = {
  nome: string;
  averbadora: string;
  tipo: string;
  status: string;
  produtos: string[];
  responsavel: string;
};

export type WindowPayload = {
  id: string;
  label: string;
  start: Date;
  end: Date;
  firstDueDate: Date;
};

export type TaxPayload = {
  id: string;
  produto: string;
  modalidade: string;
  monthlyRate: number;
  tacPercent: number;
  tacFlat: number;
  validFrom: Date;
  validUntil: Date | null;
};

export type RunAgreementUpdateArgs = {
  nextAgreement: Agreement;
  toastMessage: string;
  telemetryEvent: string;
  telemetryPayload?: Record<string, unknown>;
  note?: string;
  errorMessage?: string;
  action?: 'update' | 'create';
};

export type RunAgreementUpdate = (args: RunAgreementUpdateArgs) => Promise<{ id?: string } | null>;

export type BuildHistoryEntry = (message: string) => AgreementHistoryEntry;
