import type { Agreement, AgreementRate, AgreementWindow } from './useConvenioCatalog.ts';

export type AgreementProductOption = { value: string; label: string };
export type AgreementOption = {
  value: string;
  label: string;
  products: AgreementProductOption[];
};

const PRODUCT_LABEL_MAP: Record<string, string> = {
  emprestimo: 'Empréstimo consignado',
  consigned_credit: 'Empréstimo consignado',
  cartao_consignado: 'Cartão consignado',
  cartao_beneficio: 'Cartão benefício',
  benefit_card: 'Cartão benefício',
  fgts: 'Antecipação FGTS',
  fgts_advance: 'Antecipação FGTS',
  credit_card: 'Cartão consignado',
  payroll_portability: 'Portabilidade de salário',
};

export const normalizeString = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
};

const formatProductLabel = (value: unknown): string => {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return '';
  }

  const mapped = PRODUCT_LABEL_MAP[normalized];
  if (mapped) {
    return mapped;
  }

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)([a-z])/g, (match) => match.toUpperCase());
};

const normalizeProductOption = (entry: unknown): AgreementProductOption | null => {
  if (!entry) {
    return null;
  }

  if (typeof entry === 'string' || typeof entry === 'number') {
    const value = normalizeString(entry);
    if (!value) {
      return null;
    }
    return { value, label: formatProductLabel(value) };
  }

  if (typeof entry === 'object') {
    const record = entry as Record<string, unknown>;
    const value =
      normalizeString(record.id) ||
      normalizeString(record.value) ||
      normalizeString(record.key) ||
      normalizeString(record.slug) ||
      normalizeString(record.code);

    if (!value) {
      return null;
    }

    const label =
      normalizeString(record.label) ||
      normalizeString(record.name) ||
      normalizeString(record.title) ||
      normalizeString(record.description) ||
      formatProductLabel(value);

    return { value, label: label || formatProductLabel(value) };
  }

  return null;
};

const normalizeAgreementProducts = (agreement: Agreement | null | undefined): AgreementProductOption[] => {
  if (!agreement || typeof agreement !== 'object') {
    return [];
  }

  const sources = [
    (agreement as { products?: unknown[] }).products,
    (agreement as { allowedProducts?: unknown[] }).allowedProducts,
    (agreement as { availableProducts?: unknown[] }).availableProducts,
    (agreement as { productOptions?: unknown[] }).productOptions,
    (agreement as { productTypes?: unknown[] }).productTypes,
    (agreement as { productScope?: unknown[] }).productScope,
    (agreement as { produtos?: unknown[] }).produtos,
    (agreement as { productos?: unknown[] }).productos,
    (agreement as { productList?: unknown[] }).productList,
    (agreement.metadata as { products?: unknown[] })?.products,
    (agreement.metadata as { allowedProducts?: unknown[] })?.allowedProducts,
    (agreement.metadata as { productOptions?: unknown[] })?.productOptions,
    (agreement.metadata as { productScope?: unknown[] })?.productScope,
  ]
    .map((candidate) => (candidate instanceof Set ? Array.from(candidate) : candidate))
    .filter((candidate): candidate is unknown[] => Array.isArray(candidate) && candidate.length > 0);

  const collected: AgreementProductOption[] = [];

  for (const source of sources) {
    collected.push(...source.map((entry) => normalizeProductOption(entry)).filter(Boolean) as AgreementProductOption[]);
  }

  if (Array.isArray(agreement.taxas)) {
    collected.push(
      ...(agreement.taxas
        .map((tax) => (tax && typeof tax === 'object' ? (tax as { produto?: unknown; product?: unknown }).produto ?? (tax as { produto?: unknown; product?: unknown }).product : tax))
        .map((entry) => normalizeProductOption(entry))
        .filter(Boolean) as AgreementProductOption[]),
    );
  }

  const unique = new Map<string, AgreementProductOption>();

  collected.forEach((option) => {
    if (option && option.value && !unique.has(option.value)) {
      unique.set(option.value, { value: option.value, label: option.label || formatProductLabel(option.value) });
    }
  });

  return Array.from(unique.values());
};

const normalizeAgreementOption = (agreement: Agreement | null | undefined): AgreementOption | null => {
  if (!agreement || typeof agreement !== 'object' || agreement.archived === true) {
    return null;
  }

  const value =
    normalizeString(agreement.id) ||
    normalizeString((agreement as { identifier?: unknown }).identifier) ||
    normalizeString(agreement.slug) ||
    normalizeString((agreement as { code?: unknown }).code);

  if (!value) {
    return null;
  }

  const label =
    normalizeString(agreement.nome) ||
    normalizeString((agreement as { name?: unknown }).name) ||
    normalizeString((agreement as { displayName?: unknown }).displayName) ||
    normalizeString((agreement as { label?: unknown }).label) ||
    formatProductLabel(value);

  return {
    value,
    label: label || value,
    products: normalizeAgreementProducts(agreement),
  };
};

export const toAgreementOptions = (agreements: Agreement[] | undefined | null): AgreementOption[] => {
  if (!Array.isArray(agreements)) {
    return [];
  }

  return agreements
    .map((agreement) => normalizeAgreementOption(agreement))
    .filter((option): option is AgreementOption => Boolean(option && option.value));
};

export const getProductsByAgreement = (
  agreementOptions: AgreementOption[] | undefined | null,
): Map<string, AgreementProductOption[]> => {
  const map = new Map<string, AgreementProductOption[]>();

  (agreementOptions ?? []).forEach((option) => {
    if (option.products && option.products.length > 0) {
      map.set(option.value, option.products);
    }
  });

  return map;
};

const isValidDate = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime());

export const findActiveWindow = (
  agreement: Agreement | null | undefined,
  simulationDate: Date | null | undefined,
): AgreementWindow | null => {
  if (!agreement || !isValidDate(simulationDate)) {
    return null;
  }

  return (
    (agreement.janelas ?? []).find(
      (window) => isValidDate(window.start) && isValidDate(window.end) && simulationDate >= window.start && simulationDate <= window.end,
    ) ?? null
  );
};

type RateWithLegacyFields = AgreementRate & {
  produto?: string | null;
  product?: string | null;
  modalidade?: string | null;
  termOptions?: number[];
  bank?: { id?: string | null; name?: string | null } | null;
  table?: { id?: string | null; name?: string | null } | null;
};

const resolveRateProduct = (rate: RateWithLegacyFields): string => {
  const product = rate.produto ?? rate.product;
  return typeof product === 'string' ? product : '';
};

const normalizeStatus = (value: unknown): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim().toLowerCase() : '';

export const getActiveRates = (
  agreement: Agreement | null | undefined,
  productId: string | null | undefined,
  simulationDate: Date | null | undefined,
): RateWithLegacyFields[] => {
  if (!agreement || !Array.isArray(agreement.taxas)) {
    return [];
  }

  const normalizedProduct = typeof productId === 'string' ? productId : '';
  const targetDate = isValidDate(simulationDate) ? simulationDate : null;

  return agreement.taxas.filter((tax) => {
    const rate = tax as RateWithLegacyFields;
    if (!normalizedProduct || resolveRateProduct(rate) !== normalizedProduct) {
      return false;
    }

    const status = normalizeStatus(rate.status);
    if (status && status !== 'ativa') {
      return false;
    }

    if (targetDate && isValidDate(rate.validFrom) && targetDate < rate.validFrom) {
      return false;
    }

    if (targetDate && isValidDate(rate.validUntil) && targetDate > rate.validUntil) {
      return false;
    }

    return true;
  }) as RateWithLegacyFields[];
};
