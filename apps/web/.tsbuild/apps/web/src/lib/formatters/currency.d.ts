export type FormatCurrencyOptions = {
    locale?: string;
    currency?: string;
    fallback?: string | null;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    roundingMode?: 'round' | 'floor' | 'ceil' | 'trunc';
    roundingPrecision?: number;
};
export declare const formatCurrency: (value: unknown, options?: FormatCurrencyOptions) => string;
export default formatCurrency;
