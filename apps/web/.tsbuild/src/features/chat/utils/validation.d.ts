import { z } from 'zod';
type NullableString = string | null;
type NullableNumber = number | null;
export type ContactField = 'name' | 'document' | 'email' | 'phone';
export type DealField = 'installmentValue' | 'netValue' | 'term' | 'product' | 'bank';
export declare const normalizeTextValue: (value: unknown) => NullableString;
export declare const normalizeCurrencyValue: (value: unknown) => NullableNumber;
export declare const normalizeIntegerValue: (value: unknown) => NullableNumber;
export declare const normalizeContactFieldValue: (field: ContactField, value: unknown) => NullableString;
export declare const normalizeDealFieldValue: (field: DealField, value: unknown) => NullableString | NullableNumber;
export declare const contactFieldUpdateSchema: z.ZodEffects<z.ZodObject<{
    field: z.ZodEnum<["name", "document", "email", "phone"]>;
    value: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    field: "name" | "document" | "email" | "phone";
    value?: unknown;
}, {
    field: "name" | "document" | "email" | "phone";
    value?: unknown;
}>, {
    field: "name" | "document" | "email" | "phone";
    value: NullableString;
}, {
    field: "name" | "document" | "email" | "phone";
    value?: unknown;
}>;
export declare const dealFieldUpdateSchema: z.ZodEffects<z.ZodObject<{
    field: z.ZodEnum<["installmentValue", "netValue", "term", "product", "bank"]>;
    value: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    field: "term" | "product" | "bank" | "installmentValue" | "netValue";
    value?: unknown;
}, {
    field: "term" | "product" | "bank" | "installmentValue" | "netValue";
    value?: unknown;
}>, {
    field: "term" | "product" | "bank" | "installmentValue" | "netValue";
    value: string | number | null;
}, {
    field: "term" | "product" | "bank" | "installmentValue" | "netValue";
    value?: unknown;
}>;
export type ContactFieldUpdate = z.infer<typeof contactFieldUpdateSchema>;
export type DealFieldUpdate = z.infer<typeof dealFieldUpdateSchema>;
export {};
