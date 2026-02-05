export function getAuthToken(): any;
export function onAuthTokenChange(callback: any): () => void;
export function onAuthTokenExpire(callback: any): () => void;
export function getAuthPayload(): any;
export function setAuthToken(token: any, options?: {}): string | null;
export function clearAuthToken(): void;
export function getTenantId(): string;
export function getTenantSlugHint(): string;
export function onTenantIdChange(callback: any): () => void;
export function setTenantId(tenantId: any): string;
export function setTenantSlugHint(tenantSlug: any): string;
export function clearTenantId(): void;
export function clearTenantSlugHint(): void;
declare namespace _default {
    export { getAuthToken };
    export { setAuthToken };
    export { clearAuthToken };
    export { onAuthTokenChange };
    export { onAuthTokenExpire };
    export { getAuthPayload };
    export { getTenantId };
    export { setTenantId };
    export { getTenantSlugHint };
    export { setTenantSlugHint };
    export { clearTenantId };
    export { clearTenantSlugHint };
    export { onTenantIdChange };
}
export default _default;
