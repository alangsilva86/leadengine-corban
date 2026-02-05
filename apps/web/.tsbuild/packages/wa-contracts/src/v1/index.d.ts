import { z } from 'zod';
import { normalizeQrPayload } from './qr';
export type { NormalizedQrPayload, NormalizedQrReason } from './qr';
export declare const SendTextInputSchema: z.ZodObject<{
    sessionId: z.ZodString;
    instanceId: z.ZodOptional<z.ZodString>;
    to: z.ZodString;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    externalId: z.ZodOptional<z.ZodString>;
} & {
    message: z.ZodString;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    message: string;
    to: string;
    sessionId: string;
    metadata?: Record<string, unknown> | undefined;
    externalId?: string | undefined;
    instanceId?: string | undefined;
    idempotencyKey?: string | undefined;
    previewUrl?: boolean | undefined;
}, {
    message: string;
    to: string;
    sessionId: string;
    metadata?: Record<string, unknown> | undefined;
    externalId?: string | undefined;
    instanceId?: string | undefined;
    idempotencyKey?: string | undefined;
    previewUrl?: boolean | undefined;
}>;
export type SendTextInput = z.infer<typeof SendTextInputSchema>;
export declare const SendMediaInputSchema: z.ZodObject<{
    sessionId: z.ZodString;
    instanceId: z.ZodOptional<z.ZodString>;
    to: z.ZodString;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    externalId: z.ZodOptional<z.ZodString>;
} & {
    mediaUrl: z.ZodString;
    mediaMimeType: z.ZodOptional<z.ZodString>;
    mediaFileName: z.ZodOptional<z.ZodString>;
    mediaType: z.ZodOptional<z.ZodEnum<["image", "video", "audio", "document"]>>;
    caption: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    to: string;
    sessionId: string;
    mediaUrl: string;
    caption?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    externalId?: string | undefined;
    instanceId?: string | undefined;
    idempotencyKey?: string | undefined;
    mediaMimeType?: string | undefined;
    mediaFileName?: string | undefined;
    mediaType?: "document" | "image" | "audio" | "video" | undefined;
}, {
    to: string;
    sessionId: string;
    mediaUrl: string;
    caption?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    externalId?: string | undefined;
    instanceId?: string | undefined;
    idempotencyKey?: string | undefined;
    mediaMimeType?: string | undefined;
    mediaFileName?: string | undefined;
    mediaType?: "document" | "image" | "audio" | "video" | undefined;
}>;
export type SendMediaInput = z.infer<typeof SendMediaInputSchema>;
export declare const SendResultSchema: z.ZodObject<{
    externalId: z.ZodString;
    status: z.ZodString;
    timestamp: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    transport: z.ZodOptional<z.ZodLiteral<"http">>;
}, "strip", z.ZodTypeAny, {
    status: string;
    externalId: string;
    timestamp?: string | null | undefined;
    raw?: Record<string, unknown> | null | undefined;
    transport?: "http" | undefined;
}, {
    status: string;
    externalId: string;
    timestamp?: string | null | undefined;
    raw?: Record<string, unknown> | null | undefined;
    transport?: "http" | undefined;
}>;
export type SendResult = z.infer<typeof SendResultSchema>;
export declare const ExistsResultSchema: z.ZodObject<{
    exists: z.ZodBoolean;
    canReceive: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    exists: boolean;
    canReceive: boolean;
    reason?: string | null | undefined;
    raw?: Record<string, unknown> | null | undefined;
}, {
    exists: boolean;
    canReceive: boolean;
    reason?: string | null | undefined;
    raw?: Record<string, unknown> | null | undefined;
}>;
export type ExistsResult = z.infer<typeof ExistsResultSchema>;
export declare const StatusResultSchema: z.ZodObject<{
    status: z.ZodEnum<["connected", "connecting", "disconnected", "qr_required", "pending", "failed"]>;
    connected: z.ZodBoolean;
    qr: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    qrCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    qrExpiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    stats: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    metrics: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    rate: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    rateUsage: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    messages: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "disconnected" | "connected" | "connecting" | "qr_required" | "failed";
    connected: boolean;
    expiresAt?: string | null | undefined;
    metrics?: Record<string, unknown> | null | undefined;
    stats?: Record<string, unknown> | null | undefined;
    qr?: string | null | undefined;
    qrCode?: string | null | undefined;
    qrExpiresAt?: string | null | undefined;
    raw?: Record<string, unknown> | null | undefined;
    rate?: Record<string, unknown> | null | undefined;
    rateUsage?: Record<string, unknown> | null | undefined;
    messages?: Record<string, unknown> | null | undefined;
}, {
    status: "pending" | "disconnected" | "connected" | "connecting" | "qr_required" | "failed";
    connected: boolean;
    expiresAt?: string | null | undefined;
    metrics?: Record<string, unknown> | null | undefined;
    stats?: Record<string, unknown> | null | undefined;
    qr?: string | null | undefined;
    qrCode?: string | null | undefined;
    qrExpiresAt?: string | null | undefined;
    raw?: Record<string, unknown> | null | undefined;
    rate?: Record<string, unknown> | null | undefined;
    rateUsage?: Record<string, unknown> | null | undefined;
    messages?: Record<string, unknown> | null | undefined;
}>;
export type StatusResult = z.infer<typeof StatusResultSchema>;
export declare const WhatsAppCanonicalErrorCodeSchema: z.ZodEnum<["INSTANCE_NOT_CONNECTED", "INVALID_TO", "RATE_LIMITED", "BROKER_TIMEOUT", "UNSUPPORTED_OPERATION", "TRANSPORT_NOT_CONFIGURED", "UNKNOWN_ERROR"]>;
export type WhatsAppCanonicalErrorCode = z.infer<typeof WhatsAppCanonicalErrorCodeSchema>;
export declare const WhatsAppCanonicalErrorSchema: z.ZodObject<{
    code: z.ZodEnum<["INSTANCE_NOT_CONNECTED", "INVALID_TO", "RATE_LIMITED", "BROKER_TIMEOUT", "UNSUPPORTED_OPERATION", "TRANSPORT_NOT_CONFIGURED", "UNKNOWN_ERROR"]>;
    message: z.ZodString;
    retryable: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    message: string;
    code: "INSTANCE_NOT_CONNECTED" | "INVALID_TO" | "RATE_LIMITED" | "BROKER_TIMEOUT" | "UNSUPPORTED_OPERATION" | "TRANSPORT_NOT_CONFIGURED" | "UNKNOWN_ERROR";
    retryable?: boolean | undefined;
}, {
    message: string;
    code: "INSTANCE_NOT_CONNECTED" | "INVALID_TO" | "RATE_LIMITED" | "BROKER_TIMEOUT" | "UNSUPPORTED_OPERATION" | "TRANSPORT_NOT_CONFIGURED" | "UNKNOWN_ERROR";
    retryable?: boolean | undefined;
}>;
export type WhatsAppCanonicalError = z.infer<typeof WhatsAppCanonicalErrorSchema>;
export declare const CANONICAL_ERRORS: Record<WhatsAppCanonicalErrorCode, WhatsAppCanonicalError>;
export declare const resolveCanonicalError: (code: WhatsAppCanonicalErrorCode | string | null | undefined) => WhatsAppCanonicalError | null;
export type WhatsAppTransportErrorOptions = {
    code?: string;
    status?: number;
    requestId?: string;
    transport?: 'http';
    canonical?: WhatsAppCanonicalError | null;
    details?: Record<string, unknown> | null;
    cause?: unknown;
};
export declare class WhatsAppTransportError extends Error {
    readonly code: string;
    readonly status: number | undefined;
    readonly requestId: string | undefined;
    readonly transport: 'http' | undefined;
    readonly canonical: WhatsAppCanonicalError | null;
    readonly details?: Record<string, unknown> | null;
    constructor(message: string, options?: WhatsAppTransportErrorOptions);
}
export declare const v1: {
    SendTextInputSchema: z.ZodObject<{
        sessionId: z.ZodString;
        instanceId: z.ZodOptional<z.ZodString>;
        to: z.ZodString;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        externalId: z.ZodOptional<z.ZodString>;
    } & {
        message: z.ZodString;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        to: string;
        sessionId: string;
        metadata?: Record<string, unknown> | undefined;
        externalId?: string | undefined;
        instanceId?: string | undefined;
        idempotencyKey?: string | undefined;
        previewUrl?: boolean | undefined;
    }, {
        message: string;
        to: string;
        sessionId: string;
        metadata?: Record<string, unknown> | undefined;
        externalId?: string | undefined;
        instanceId?: string | undefined;
        idempotencyKey?: string | undefined;
        previewUrl?: boolean | undefined;
    }>;
    SendMediaInputSchema: z.ZodObject<{
        sessionId: z.ZodString;
        instanceId: z.ZodOptional<z.ZodString>;
        to: z.ZodString;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        externalId: z.ZodOptional<z.ZodString>;
    } & {
        mediaUrl: z.ZodString;
        mediaMimeType: z.ZodOptional<z.ZodString>;
        mediaFileName: z.ZodOptional<z.ZodString>;
        mediaType: z.ZodOptional<z.ZodEnum<["image", "video", "audio", "document"]>>;
        caption: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        to: string;
        sessionId: string;
        mediaUrl: string;
        caption?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
        externalId?: string | undefined;
        instanceId?: string | undefined;
        idempotencyKey?: string | undefined;
        mediaMimeType?: string | undefined;
        mediaFileName?: string | undefined;
        mediaType?: "document" | "image" | "audio" | "video" | undefined;
    }, {
        to: string;
        sessionId: string;
        mediaUrl: string;
        caption?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
        externalId?: string | undefined;
        instanceId?: string | undefined;
        idempotencyKey?: string | undefined;
        mediaMimeType?: string | undefined;
        mediaFileName?: string | undefined;
        mediaType?: "document" | "image" | "audio" | "video" | undefined;
    }>;
    SendResultSchema: z.ZodObject<{
        externalId: z.ZodString;
        status: z.ZodString;
        timestamp: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        raw: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        transport: z.ZodOptional<z.ZodLiteral<"http">>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        externalId: string;
        timestamp?: string | null | undefined;
        raw?: Record<string, unknown> | null | undefined;
        transport?: "http" | undefined;
    }, {
        status: string;
        externalId: string;
        timestamp?: string | null | undefined;
        raw?: Record<string, unknown> | null | undefined;
        transport?: "http" | undefined;
    }>;
    ExistsResultSchema: z.ZodObject<{
        exists: z.ZodBoolean;
        canReceive: z.ZodBoolean;
        reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        raw: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, "strip", z.ZodTypeAny, {
        exists: boolean;
        canReceive: boolean;
        reason?: string | null | undefined;
        raw?: Record<string, unknown> | null | undefined;
    }, {
        exists: boolean;
        canReceive: boolean;
        reason?: string | null | undefined;
        raw?: Record<string, unknown> | null | undefined;
    }>;
    StatusResultSchema: z.ZodObject<{
        status: z.ZodEnum<["connected", "connecting", "disconnected", "qr_required", "pending", "failed"]>;
        connected: z.ZodBoolean;
        qr: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        qrCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        qrExpiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stats: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        metrics: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        rate: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        rateUsage: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        messages: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        raw: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "disconnected" | "connected" | "connecting" | "qr_required" | "failed";
        connected: boolean;
        expiresAt?: string | null | undefined;
        metrics?: Record<string, unknown> | null | undefined;
        stats?: Record<string, unknown> | null | undefined;
        qr?: string | null | undefined;
        qrCode?: string | null | undefined;
        qrExpiresAt?: string | null | undefined;
        raw?: Record<string, unknown> | null | undefined;
        rate?: Record<string, unknown> | null | undefined;
        rateUsage?: Record<string, unknown> | null | undefined;
        messages?: Record<string, unknown> | null | undefined;
    }, {
        status: "pending" | "disconnected" | "connected" | "connecting" | "qr_required" | "failed";
        connected: boolean;
        expiresAt?: string | null | undefined;
        metrics?: Record<string, unknown> | null | undefined;
        stats?: Record<string, unknown> | null | undefined;
        qr?: string | null | undefined;
        qrCode?: string | null | undefined;
        qrExpiresAt?: string | null | undefined;
        raw?: Record<string, unknown> | null | undefined;
        rate?: Record<string, unknown> | null | undefined;
        rateUsage?: Record<string, unknown> | null | undefined;
        messages?: Record<string, unknown> | null | undefined;
    }>;
    WhatsAppCanonicalErrorCodeSchema: z.ZodEnum<["INSTANCE_NOT_CONNECTED", "INVALID_TO", "RATE_LIMITED", "BROKER_TIMEOUT", "UNSUPPORTED_OPERATION", "TRANSPORT_NOT_CONFIGURED", "UNKNOWN_ERROR"]>;
    WhatsAppCanonicalErrorSchema: z.ZodObject<{
        code: z.ZodEnum<["INSTANCE_NOT_CONNECTED", "INVALID_TO", "RATE_LIMITED", "BROKER_TIMEOUT", "UNSUPPORTED_OPERATION", "TRANSPORT_NOT_CONFIGURED", "UNKNOWN_ERROR"]>;
        message: z.ZodString;
        retryable: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        code: "INSTANCE_NOT_CONNECTED" | "INVALID_TO" | "RATE_LIMITED" | "BROKER_TIMEOUT" | "UNSUPPORTED_OPERATION" | "TRANSPORT_NOT_CONFIGURED" | "UNKNOWN_ERROR";
        retryable?: boolean | undefined;
    }, {
        message: string;
        code: "INSTANCE_NOT_CONNECTED" | "INVALID_TO" | "RATE_LIMITED" | "BROKER_TIMEOUT" | "UNSUPPORTED_OPERATION" | "TRANSPORT_NOT_CONFIGURED" | "UNKNOWN_ERROR";
        retryable?: boolean | undefined;
    }>;
    CANONICAL_ERRORS: Record<"INSTANCE_NOT_CONNECTED" | "INVALID_TO" | "RATE_LIMITED" | "BROKER_TIMEOUT" | "UNSUPPORTED_OPERATION" | "TRANSPORT_NOT_CONFIGURED" | "UNKNOWN_ERROR", {
        message: string;
        code: "INSTANCE_NOT_CONNECTED" | "INVALID_TO" | "RATE_LIMITED" | "BROKER_TIMEOUT" | "UNSUPPORTED_OPERATION" | "TRANSPORT_NOT_CONFIGURED" | "UNKNOWN_ERROR";
        retryable?: boolean | undefined;
    }>;
    resolveCanonicalError: (code: WhatsAppCanonicalErrorCode | string | null | undefined) => WhatsAppCanonicalError | null;
    WhatsAppTransportError: typeof WhatsAppTransportError;
    normalizeQrPayload: (value: unknown) => import("@/features/whatsapp/utils/qr").NormalizedQrPayload;
};
export { normalizeQrPayload };
export type { SendTextInput as SendTextInputV1, SendMediaInput as SendMediaInputV1, SendResult as SendResultV1, ExistsResult as ExistsResultV1, StatusResult as StatusResultV1, WhatsAppCanonicalError as WhatsAppCanonicalErrorV1, WhatsAppCanonicalErrorCode as WhatsAppCanonicalErrorCodeV1 };
