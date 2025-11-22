const readTenantString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const pickTenantId = (record: unknown): string | null => {
  if (!record || typeof record !== 'object') {
    return readTenantString(record);
  }

  const source = record as Record<string, unknown>;
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

const resolveInstanceTenantId = (instance: unknown): string | null => {
  if (!instance || typeof instance !== 'object') {
    return readTenantString(instance);
  }

  const baseTenant = pickTenantId(instance);
  if (baseTenant) {
    return baseTenant;
  }

  const metadata =
    (instance as Record<string, unknown>).metadata &&
    typeof (instance as Record<string, unknown>).metadata === 'object'
      ? ((instance as Record<string, unknown>).metadata as Record<string, unknown>)
      : null;

  return metadata ? pickTenantId(metadata) : null;
};

const resolveAgreementTenantId = (agreement: unknown): string | null => {
  if (!agreement || typeof agreement !== 'object') {
    return readTenantString(agreement);
  }

  const directTenant = pickTenantId(agreement);
  if (directTenant) {
    return directTenant;
  }

  const metadata =
    (agreement as Record<string, unknown>).metadata &&
    typeof (agreement as Record<string, unknown>).metadata === 'object'
      ? ((agreement as Record<string, unknown>).metadata as Record<string, unknown>)
      : null;
  if (metadata) {
    const metaTenant = pickTenantId(metadata);
    if (metaTenant) {
      return metaTenant;
    }
  }

  const account =
    (agreement as Record<string, unknown>).account &&
    typeof (agreement as Record<string, unknown>).account === 'object'
      ? ((agreement as Record<string, unknown>).account as Record<string, unknown>)
      : null;
  if (account) {
    const accountTenant = pickTenantId(account);
    if (accountTenant) {
      return accountTenant;
    }
  }

  return null;
};

const resolveTenantDisplayName = (agreement: unknown): string | null => {
  if (!agreement || typeof agreement !== 'object') {
    return null;
  }
  const record = agreement as Record<string, unknown>;
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

  const tenant =
    record.tenant && typeof record.tenant === 'object'
      ? (record.tenant as Record<string, unknown>)
      : null;
  if (tenant) {
    const tenantName =
      readTenantString(tenant.name) ??
      readTenantString(tenant.displayName) ??
      readTenantString(tenant.label) ??
      readTenantString(tenant.slug);
    if (tenantName) {
      return tenantName;
    }
  }

  const account =
    record.account && typeof record.account === 'object'
      ? (record.account as Record<string, unknown>)
      : null;
  if (account) {
    const accountName =
      readTenantString(account.name) ??
      readTenantString(account.displayName) ??
      readTenantString(account.label);
    if (accountName) {
      return accountName;
    }
  }

  return resolveAgreementTenantId(agreement);
};

export {
  pickTenantId,
  readTenantString,
  resolveAgreementTenantId,
  resolveInstanceTenantId,
  resolveTenantDisplayName,
};
