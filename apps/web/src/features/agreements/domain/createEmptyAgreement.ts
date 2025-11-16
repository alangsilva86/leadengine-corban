import { generateId } from '../convenioSettings.utils.ts';
import type { Agreement } from '../useConvenioCatalog.ts';
import { createHistoryEntry } from './createHistoryEntry.ts';

type CreateEmptyAgreementParams = {
  author: string;
  idFactory?: () => string;
  createdAt?: Date;
};

export const createEmptyAgreement = ({
  author,
  idFactory = generateId,
  createdAt = new Date(),
}: CreateEmptyAgreementParams): Agreement => ({
  id: idFactory(),
  slug: '',
  nome: 'Novo convênio',
  averbadora: '',
  tipo: 'MUNICIPAL',
  status: 'EM_IMPLANTACAO',
  produtos: [],
  responsavel: '',
  archived: false,
  metadata: {},
  janelas: [],
  taxas: [],
  history: [
    createHistoryEntry({
      author,
      message: 'Convênio criado. Complete dados básicos e tabelas.',
      createdAt,
      idFactory,
    }),
  ],
});

export default createEmptyAgreement;
