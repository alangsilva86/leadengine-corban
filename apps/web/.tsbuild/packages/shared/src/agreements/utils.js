const hasString = (value) => typeof value === 'string';
export const slugify = (value) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
export const mapProductsToRecord = (products) => products.reduce((acc, product) => {
    const key = product.trim();
    if (key) {
        acc[key] = true;
    }
    return acc;
}, {});
export const applyAgreementMetadataDefaults = (metadata, defaults = {}, options = {}) => {
    const base = metadata && typeof metadata === 'object' ? { ...metadata } : {};
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
export const translateLegacyAgreementFields = (data) => {
    if (!data || typeof data !== 'object') {
        return {};
    }
    const source = data;
    const normalized = { ...source };
    if (hasString(source.nome) && !hasString(normalized.name)) {
        normalized.name = source.nome;
    }
    if (typeof normalized.slug !== 'string' && typeof normalized.name === 'string') {
        const candidate = slugify(normalized.name);
        normalized.slug = candidate.length ? candidate : normalized.name;
    }
    if (hasString(source.tipo) && !hasString(normalized.type)) {
        normalized.type = source.tipo;
    }
    if (!normalized.products) {
        if (Array.isArray(source.produtos)) {
            const productList = source.produtos.filter((item) => typeof item === 'string');
            normalized.products = mapProductsToRecord(productList);
        }
        else if (source.produtos && typeof source.produtos === 'object') {
            normalized.products = source.produtos;
        }
    }
    const productsForMetadata = Array.isArray(source.produtos)
        ? source.produtos.filter((item) => typeof item === 'string')
        : normalized.products && typeof normalized.products === 'object'
            ? Object.keys(normalized.products)
            : undefined;
    const metadata = applyAgreementMetadataDefaults(normalized.metadata, {
        providerName: hasString(source.averbadora) ? source.averbadora : null,
        responsavel: hasString(source.responsavel) ? source.responsavel : null,
        products: productsForMetadata ?? null,
    }, { overwrite: false });
    if (Object.keys(metadata).length) {
        normalized.metadata = metadata;
    }
    else {
        delete normalized.metadata;
    }
    return normalized;
};
