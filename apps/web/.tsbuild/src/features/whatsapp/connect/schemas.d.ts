import { z } from 'zod';
export declare const pairingPhoneSchema: z.ZodEffects<z.ZodObject<{
    phone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
}, {
    phone: string;
}>, {
    phone: string;
}, {
    phone: string;
}>;
export declare const createInstanceSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    id: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id?: string | undefined;
}, {
    name: string;
    id?: string | undefined;
}>, {
    name: string;
    id: string | undefined;
}, {
    name: string;
    id?: string | undefined;
}>;
export declare const createCampaignSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    instanceId: z.ZodString;
    agreementId: z.ZodString;
    agreementName: z.ZodString;
    product: z.ZodString;
    margin: z.ZodEffects<z.ZodEffects<z.ZodNumber, number, unknown>, number, unknown>;
    strategy: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["active", "paused", "draft"]>>;
    leadSource: z.ZodEnum<["inbound", "internal_list", "partner"]>;
    marginType: z.ZodEffects<z.ZodOptional<z.ZodString>, string, string | undefined>;
    segments: z.ZodEffects<z.ZodOptional<z.ZodArray<z.ZodString, "many">>, string[], string[] | undefined>;
    tags: z.ZodEffects<z.ZodOptional<z.ZodArray<z.ZodString, "many">>, string[] | undefined, string[] | undefined>;
}, "strip", z.ZodTypeAny, {
    name: string;
    status: "paused" | "active" | "draft";
    instanceId: string;
    agreementId: string;
    agreementName: string;
    product: string;
    margin: number;
    strategy: string;
    leadSource: "inbound" | "internal_list" | "partner";
    marginType: string;
    segments: string[];
    tags?: string[] | undefined;
}, {
    name: string;
    instanceId: string;
    agreementId: string;
    agreementName: string;
    product: string;
    strategy: string;
    leadSource: "inbound" | "internal_list" | "partner";
    status?: "paused" | "active" | "draft" | undefined;
    tags?: string[] | undefined;
    margin?: unknown;
    marginType?: string | undefined;
    segments?: string[] | undefined;
}>, {
    tags?: string[];
    segments?: string[];
    name: string;
    instanceId: string;
    status: "paused" | "active" | "draft";
    agreementId: string;
    agreementName: string;
    leadSource: "inbound" | "internal_list" | "partner";
    strategy: string;
    productType: string;
    marginType: string;
    marginValue: number;
}, {
    name: string;
    instanceId: string;
    agreementId: string;
    agreementName: string;
    product: string;
    strategy: string;
    leadSource: "inbound" | "internal_list" | "partner";
    status?: "paused" | "active" | "draft" | undefined;
    tags?: string[] | undefined;
    margin?: unknown;
    marginType?: string | undefined;
    segments?: string[] | undefined;
}>;
export type PairingPhoneInput = z.infer<typeof pairingPhoneSchema>;
export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
