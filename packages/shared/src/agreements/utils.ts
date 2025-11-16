export type AgreementMetadataDefaults = {
  providerName?: string | null;
  responsavel?: string | null;
  products?: string[] | null;
};

export type AgreementMetadataOptions = {
  overwrite?: boolean;
};

const hasString = (value: unknown): value is string => typeof value === 'string';

export const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

export const mapProductsToRecord = (products: string[]): Record<string, unknown> =>
  products.reduce<Record<string, unknown>>((acc, product) => {
    const key = product.trim();
    if (key) {
      acc[key] = true;
    }
    return acc;
  }, {});

export const applyAgreementMetadataDefaults = (
  metadata: unknown,
  defaults: AgreementMetadataDefaults = {},
  options: AgreementMetadataOptions = {}
): Record<string, unknown> => {
  const base = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  const { overwrite = false } = options;

  if (hasString(defaults.providerName) && (overwrite || !hasString(base.providerName))) {
    base.providerName = defaults.providerName;
  }

  if (hasString(defaults.responsavel) && (overwrite || !hasString(base.responsavel))) {
    base.responsavel = defaults.responsavel;
  }

  if (Array.isArray(defaults.products) && (overwrite || !Array.isArray(base.products))) {
    base.products = defaults.products;
  }

  return base;
};

export const translateLegacyAgreementFields = (data: unknown): Record<string, unknown> => {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const source = data as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...source };

  if (hasString(source.nome) && !hasString(normalized.name)) {
    normalized.name = source.nome;
  }

  if (typeof normalized.slug !== 'string' && typeof normalized.name === 'string') {
    const candidate = slugify(normalized.name as string);
    normalized.slug = candidate.length ? candidate : (normalized.name as string);
  }

  if (hasString(source.tipo) && !hasString(normalized.type)) {
    normalized.type = source.tipo;
  }

  if (!normalized.products) {
    if (Array.isArray(source.produtos)) {
      const productList = source.produtos.filter((item): item is string => typeof item === 'string');
      normalized.products = mapProductsToRecord(productList);
    } else if (source.produtos && typeof source.produtos === 'object') {
      normalized.products = source.produtos;
    }
  }

  const productsForMetadata = Array.isArray(source.produtos)
    ? source.produtos.filter((item): item is string => typeof item === 'string')
    : normalized.products && typeof normalized.products === 'object'
      ? Object.keys(normalized.products as Record<string, unknown>)
      : undefined;

  const metadata = applyAgreementMetadataDefaults(
    normalized.metadata,
    {
      providerName: hasString(source.averbadora) ? source.averbadora : undefined,
      responsavel: hasString(source.responsavel) ? source.responsavel : undefined,
      products: productsForMetadata,
    },
    { overwrite: false }
  );

  if (Object.keys(metadata).length) {
    normalized.metadata = metadata;
  } else {
    delete normalized.metadata;
  }

  return normalized;
};
