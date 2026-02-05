const readTenantString = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    return null;
};
const pickTenantId = (record) => {
    if (!record || typeof record !== 'object') {
        return readTenantString(record);
    }
    const source = record;
    const directCandidates = [
        source.tenantId,
        source.tenant_id,
        source.tenantSlug,
        source.scopeTenantId,
        source.scope_tenant_id,
    ];
    for (const candidate of directCandidates) {
        const resolved = readTenantString(candidate);
        if (resolved) {
            return resolved;
        }
    }
    const nestedSources = ['tenant', 'account', 'scope'];
    for (const key of nestedSources) {
        if (source[key] && typeof source[key] === 'object') {
            const nested = pickTenantId(source[key]);
            if (nested) {
                return nested;
            }
        }
    }
    return null;
};
const resolveInstanceTenantId = (instance) => {
    if (!instance || typeof instance !== 'object') {
        return readTenantString(instance);
    }
    const baseTenant = pickTenantId(instance);
    if (baseTenant) {
        return baseTenant;
    }
    const metadata = instance.metadata &&
        typeof instance.metadata === 'object'
        ? instance.metadata
        : null;
    return metadata ? pickTenantId(metadata) : null;
};
const resolveAgreementTenantId = (agreement) => {
    if (!agreement || typeof agreement !== 'object') {
        return readTenantString(agreement);
    }
    const directTenant = pickTenantId(agreement);
    if (directTenant) {
        return directTenant;
    }
    const metadata = agreement.metadata &&
        typeof agreement.metadata === 'object'
        ? agreement.metadata
        : null;
    if (metadata) {
        const metaTenant = pickTenantId(metadata);
        if (metaTenant) {
            return metaTenant;
        }
    }
    const account = agreement.account &&
        typeof agreement.account === 'object'
        ? agreement.account
        : null;
    if (account) {
        const accountTenant = pickTenantId(account);
        if (accountTenant) {
            return accountTenant;
        }
    }
    return null;
};
const resolveTenantDisplayName = (agreement) => {
    if (!agreement || typeof agreement !== 'object') {
        return null;
    }
    const record = agreement;
    const candidates = [
        record.tenantName,
        record.tenantLabel,
        record.tenantSlug,
        record.accountName,
        record.accountLabel,
        record.scopeName,
    ];
    for (const candidate of candidates) {
        const resolved = readTenantString(candidate);
        if (resolved) {
            return resolved;
        }
    }
    const tenant = record.tenant && typeof record.tenant === 'object'
        ? record.tenant
        : null;
    if (tenant) {
        const tenantName = readTenantString(tenant.name) ??
            readTenantString(tenant.displayName) ??
            readTenantString(tenant.label) ??
            readTenantString(tenant.slug);
        if (tenantName) {
            return tenantName;
        }
    }
    const account = record.account && typeof record.account === 'object'
        ? record.account
        : null;
    if (account) {
        const accountName = readTenantString(account.name) ??
            readTenantString(account.displayName) ??
            readTenantString(account.label);
        if (accountName) {
            return accountName;
        }
    }
    return resolveAgreementTenantId(agreement);
};
export { pickTenantId, readTenantString, resolveAgreementTenantId, resolveInstanceTenantId, resolveTenantDisplayName, };
