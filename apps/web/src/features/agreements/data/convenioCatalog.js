const CONVENIO_CATALOG_TEMPLATES = [
  {
    id: 'gov-pr',
    nome: 'Governo do Paraná',
    averbadora: 'Celepar',
    tipo: 'ESTADUAL',
    status: 'ATIVO',
    produtos: ['Cartão benefício – Saque', 'Consignado tradicional'],
    responsavel: 'Ana Paula (Comercial)',
    archived: false,
    janelas: [
      {
        id: 'gov-pr-nov',
        start: '2025-11-01',
        end: '2025-11-30',
        firstDueDate: '2026-02-10',
        label: 'Novembro/25',
      },
      {
        id: 'gov-pr-dez',
        start: '2025-12-01',
        end: '2025-12-31',
        firstDueDate: '2026-03-10',
        label: 'Dezembro/25',
      },
    ],
    taxas: [
      {
        id: 'gov-pr-saque-normal',
        produto: 'Cartão benefício – Saque',
        modalidade: 'NORMAL',
        bank: { id: 'banco-alfa', name: 'Banco Alfa' },
        table: { id: 'tabela-alfa-normal', name: 'Alfa • Normal 84x' },
        termOptions: [48, 72, 84],
        monthlyRate: 4.8,
        tacPercent: 2.5,
        tacFlat: 0,
        validFrom: '2025-10-01',
        validUntil: null,
        status: 'Ativa',
      },
      {
        id: 'gov-pr-saque-flex1',
        produto: 'Cartão benefício – Saque',
        modalidade: 'FLEX1',
        bank: { id: 'banco-beta', name: 'Banco Beta' },
        table: { id: 'tabela-beta-flex1', name: 'Beta • Flex 1' },
        termOptions: [48, 72, 84],
        monthlyRate: 4.3,
        tacPercent: 2.5,
        tacFlat: 0,
        validFrom: '2025-10-01',
        validUntil: null,
        status: 'Ativa',
      },
      {
        id: 'gov-pr-saque-flex2',
        produto: 'Cartão benefício – Saque',
        modalidade: 'FLEX2',
        bank: { id: 'banco-gamma', name: 'Banco Gama' },
        table: { id: 'tabela-gamma-flex2', name: 'Gama • Flex 2' },
        termOptions: [48, 60, 72],
        monthlyRate: 3.9,
        tacPercent: 2.5,
        tacFlat: 0,
        validFrom: '2025-10-01',
        validUntil: null,
        status: 'Ativa',
      },
      {
        id: 'gov-pr-consig-normal',
        produto: 'Consignado tradicional',
        modalidade: 'NORMAL',
        bank: { id: 'banco-delta', name: 'Banco Delta' },
        table: { id: 'tabela-delta-consig', name: 'Delta • Consignado' },
        termOptions: [60, 72, 84],
        monthlyRate: 2.99,
        tacPercent: 1.8,
        tacFlat: 0,
        validFrom: '2025-10-01',
        validUntil: null,
        status: 'Ativa',
      },
    ],
    history: [
      {
        id: 'hist-1',
        author: 'Carlos (Admin)',
        message: 'Taxa Normal ajustada de 4,50% para 4,80%.',
        createdAt: '2025-10-14T10:22:00Z',
      },
      {
        id: 'hist-2',
        author: 'Ana Paula (Comercial)',
        message: 'Criada janela Novembro/25 com 1º vencimento em 10/02/26.',
        createdAt: '2025-09-30T17:45:00Z',
      },
    ],
  },
  {
    id: 'pref-curitiba',
    nome: 'Prefeitura de Curitiba',
    averbadora: 'Inova Curitiba',
    tipo: 'MUNICIPAL',
    status: 'EM_IMPLANTACAO',
    produtos: ['Consignado tradicional'],
    responsavel: 'Mariana (Implantação)',
    archived: false,
    janelas: [],
    taxas: [],
    history: [
      {
        id: 'hist-3',
        author: 'Mariana (Implantação)',
        message: 'Convênio criado e aguardando calendário de contratação.',
        createdAt: '2025-11-05T09:10:00Z',
      },
    ],
  },
];

const toDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const cloneWindow = (window) => ({
  ...window,
  start: toDate(window.start),
  end: toDate(window.end),
  firstDueDate: toDate(window.firstDueDate),
});

const cloneTax = (tax) => ({
  ...tax,
  validFrom: toDate(tax.validFrom),
  validUntil: toDate(tax.validUntil),
});

const cloneHistoryEntry = (entry) => ({
  ...entry,
  createdAt: toDate(entry.createdAt),
});

export const buildConvenioCatalog = () =>
  CONVENIO_CATALOG_TEMPLATES.map((convenio) => ({
    ...convenio,
    janelas: (convenio.janelas ?? []).map(cloneWindow),
    taxas: (convenio.taxas ?? []).map(cloneTax),
    history: (convenio.history ?? []).map(cloneHistoryEntry),
  }));

export default CONVENIO_CATALOG_TEMPLATES;
