export const API_BASE_URL: string;
export function buildDefaultApiHeaders(extraHeaders?: {}): {
    Accept: string;
};
export function buildUrl(path: any): any;
export function apiGet(path: any, options?: {}): Promise<any>;
export function apiPost(path: any, body: any, options?: {}): Promise<any>;
export function apiUpload(path: any, formData: any, options?: {}): Promise<any>;
export function apiPatch(path: any, body: any, options?: {}): Promise<any>;
export function apiDelete(path: any, options?: {}): Promise<any>;
