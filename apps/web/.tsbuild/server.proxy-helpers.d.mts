export function sanitizePathname(value: any): string;
export function createProxyPathNormalizer(proxyUrl: any): {
    origin: string;
    basePathname: string;
    normalizeRequestUrl: (incoming: any) => string;
    buildTargetUrl: (incoming: any) => string;
} | null;
