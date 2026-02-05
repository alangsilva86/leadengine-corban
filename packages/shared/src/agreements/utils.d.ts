export type AgreementMetadataDefaults = {
    providerName?: string | null;
    responsavel?: string | null;
    products?: string[] | null;
};
export type AgreementMetadataOptions = {
    overwrite?: boolean;
};
export declare const slugify: (value: string) => string;
export declare const mapProductsToRecord: (products: string[]) => Record<string, unknown>;
export declare const applyAgreementMetadataDefaults: (metadata: unknown, defaults?: AgreementMetadataDefaults, options?: AgreementMetadataOptions) => Record<string, unknown>;
export declare const translateLegacyAgreementFields: (data: unknown) => Record<string, unknown>;
