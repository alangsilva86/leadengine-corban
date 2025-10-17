export declare const FEATURE_DEBUG_WHATSAPP: "FEATURE_DEBUG_WHATSAPP";
export type SharedFeatureFlags = {
    whatsappDebug: boolean;
};
type EnvSource = Record<string, string | undefined> | undefined | null;
export declare const resolveSharedFeatureFlags: (env?: EnvSource) => SharedFeatureFlags;
export declare const getBackendFeatureFlags: (env?: EnvSource) => SharedFeatureFlags;
export declare const getFrontendFeatureFlags: (env?: EnvSource) => SharedFeatureFlags;
export declare const isWhatsappDebugEnabled: (env?: EnvSource) => boolean;
export {};
