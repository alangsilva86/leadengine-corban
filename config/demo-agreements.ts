export interface DemoAgreementRateSeed {
  id?: string;
  termMonths?: number | null;
  coefficient?: number | string | null;
  monthlyRate?: number | string | null;
  annualRate?: number | string | null;
  tacPercentage?: number | string | null;
  metadata?: Record<string, unknown>;
}

export interface DemoAgreementTableSeed {
  id?: string;
  name: string;
  product: string;
  modality: string;
  version?: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  metadata?: Record<string, unknown>;
  rates?: DemoAgreementRateSeed[];
}

export interface DemoAgreementSeed {
  id?: string;
  name: string;
  slug: string;
  status?: string;
  type?: string | null;
  segment?: string | null;
  description?: string | null;
  tags?: string[];
  products?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  publishedAt?: string;
  tables?: DemoAgreementTableSeed[];
}

export const demoAgreementsSeed: DemoAgreementSeed[] = [
  {
    id: 'saec-goiania',
    name: 'Convênio SAEC Goiânia',
    slug: 'saec-goiania',
    status: 'published',
    type: 'municipal',
    segment: 'servidor-publico',
    description: 'Tabela municipal de consignado atualizada para servidores de Goiânia.',
    tags: ['consignado', 'municipal', 'publico'],
    products: {
      consignado: {
        modalities: ['publico'],
        minMargin: 0.3,
        maxMargin: 0.45,
      },
    },
    metadata: {
      seed: true,
      channel: 'config',
    },
    tables: [
      {
        id: 'saec-goiania-consignado-2025',
        name: 'Tabela Consignado 2025',
        product: 'consignado',
        modality: 'publico',
        version: 1,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        metadata: {
          channel: 'config',
          importedAt: '2025-02-01T12:00:00.000Z',
        },
        rates: [
          {
            id: 'saec-goiania-consignado-2025-48',
            termMonths: 48,
            coefficient: 0.02785,
            monthlyRate: 0.0172,
            annualRate: 0.2291,
            tacPercentage: 0.02,
          },
          {
            id: 'saec-goiania-consignado-2025-60',
            termMonths: 60,
            coefficient: 0.0321,
            monthlyRate: 0.0189,
            annualRate: 0.2488,
            tacPercentage: 0.018,
          },
        ],
      },
    ],
  },
  {
    id: 'ipaseal-alagoas',
    name: 'Convênio IPASEAL Alagoas',
    slug: 'ipaseal-alagoas',
    status: 'published',
    type: 'estadual',
    segment: 'aposentado-pensionista',
    description: 'Tabela estadual com linha de crédito híbrida consignado + cartão.',
    tags: ['consignado', 'cartao', 'estadual'],
    products: {
      consignado: {
        modalities: ['aposentado'],
        minMargin: 0.28,
        maxMargin: 0.42,
      },
      cartao: {
        modalities: ['beneficio'],
        minMargin: 0.22,
        maxMargin: 0.32,
      },
    },
    metadata: {
      seed: true,
      channel: 'config',
    },
    tables: [
      {
        id: 'ipaseal-consignado-2025',
        name: 'Consignado Servidores 2025',
        product: 'consignado',
        modality: 'aposentado',
        version: 1,
        effectiveFrom: '2025-02-01T00:00:00.000Z',
        metadata: {
          channel: 'config',
          importedAt: '2025-02-10T15:00:00.000Z',
        },
        rates: [
          {
            id: 'ipaseal-consignado-2025-72',
            termMonths: 72,
            coefficient: 0.0265,
            monthlyRate: 0.0163,
            annualRate: 0.2126,
            tacPercentage: 0.017,
          },
        ],
      },
      {
        id: 'ipaseal-cartao-2025',
        name: 'Cartão Benefício 2025',
        product: 'cartao',
        modality: 'beneficio',
        version: 1,
        effectiveFrom: '2025-02-01T00:00:00.000Z',
        metadata: {
          channel: 'config',
          importedAt: '2025-02-10T15:00:00.000Z',
        },
        rates: [
          {
            id: 'ipaseal-cartao-2025-999',
            termMonths: null,
            coefficient: 0.015,
            monthlyRate: 0.015,
            annualRate: 0.194,
            tacPercentage: 0.012,
          },
        ],
      },
    ],
  },
];
