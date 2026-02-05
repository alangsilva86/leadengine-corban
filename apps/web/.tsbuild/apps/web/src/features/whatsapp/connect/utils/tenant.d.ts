declare const readTenantString: (value: unknown) => string | null;
declare const pickTenantId: (record: unknown) => string | null;
declare const resolveInstanceTenantId: (instance: unknown) => string | null;
declare const resolveAgreementTenantId: (agreement: unknown) => string | null;
declare const resolveTenantDisplayName: (agreement: unknown) => string | null;
export { pickTenantId, readTenantString, resolveAgreementTenantId, resolveInstanceTenantId, resolveTenantDisplayName, };
