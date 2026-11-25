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
    message: z.ZodString;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type SendTextInput = z.infer<typeof SendTextInputSchema>;
export declare const SendMediaInputSchema: z.ZodObject<{
    sessionId: z.ZodString;
    instanceId: z.ZodOptional<z.ZodString>;
    to: z.ZodString;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    externalId: z.ZodOptional<z.ZodString>;
    mediaUrl: z.ZodString;
    mediaMimeType: z.ZodOptional<z.ZodString>;
    mediaFileName: z.ZodOptional<z.ZodString>;
    mediaType: z.ZodOptional<z.ZodEnum<{
        image: "image";
        video: "video";
        audio: "audio";
        document: "document";
    }>>;
    caption: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SendMediaInput = z.infer<typeof SendMediaInputSchema>;
export declare const SendResultSchema: z.ZodObject<{
    externalId: z.ZodString;
    status: z.ZodString;
    timestamp: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    transport: z.ZodOptional<z.ZodLiteral<"http">>;
}, z.core.$strip>;
export type SendResult = z.infer<typeof SendResultSchema>;
export declare const ExistsResultSchema: z.ZodObject<{
    exists: z.ZodBoolean;
    canReceive: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    raw: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type ExistsResult = z.infer<typeof ExistsResultSchema>;
export declare const StatusResultSchema: z.ZodObject<{
    status: z.ZodEnum<{
        connected: "connected";
        connecting: "connecting";
        disconnected: "disconnected";
        qr_required: "qr_required";
        pending: "pending";
        failed: "failed";
    }>;
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
}, z.core.$strip>;
export type StatusResult = z.infer<typeof StatusResultSchema>;
export declare const WhatsAppCanonicalErrorCodeSchema: z.ZodEnum<{
    INSTANCE_NOT_CONNECTED: "INSTANCE_NOT_CONNECTED";
    INVALID_TO: "INVALID_TO";
    RATE_LIMITED: "RATE_LIMITED";
    BROKER_TIMEOUT: "BROKER_TIMEOUT";
    UNSUPPORTED_OPERATION: "UNSUPPORTED_OPERATION";
    TRANSPORT_NOT_CONFIGURED: "TRANSPORT_NOT_CONFIGURED";
    UNKNOWN_ERROR: "UNKNOWN_ERROR";
}>;
export type WhatsAppCanonicalErrorCode = z.infer<typeof WhatsAppCanonicalErrorCodeSchema>;
export declare const WhatsAppCanonicalErrorSchema: z.ZodObject<{
    code: z.ZodEnum<{
        INSTANCE_NOT_CONNECTED: "INSTANCE_NOT_CONNECTED";
        INVALID_TO: "INVALID_TO";
        RATE_LIMITED: "RATE_LIMITED";
        BROKER_TIMEOUT: "BROKER_TIMEOUT";
        UNSUPPORTED_OPERATION: "UNSUPPORTED_OPERATION";
        TRANSPORT_NOT_CONFIGURED: "TRANSPORT_NOT_CONFIGURED";
        UNKNOWN_ERROR: "UNKNOWN_ERROR";
    }>;
    message: z.ZodString;
    retryable: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
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
        message: z.ZodString;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    SendMediaInputSchema: z.ZodObject<{
        sessionId: z.ZodString;
        instanceId: z.ZodOptional<z.ZodString>;
        to: z.ZodString;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        externalId: z.ZodOptional<z.ZodString>;
        mediaUrl: z.ZodString;
        mediaMimeType: z.ZodOptional<z.ZodString>;
        mediaFileName: z.ZodOptional<z.ZodString>;
        mediaType: z.ZodOptional<z.ZodEnum<{
            image: "image";
            video: "video";
            audio: "audio";
            document: "document";
        }>>;
        caption: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    SendResultSchema: z.ZodObject<{
        externalId: z.ZodString;
        status: z.ZodString;
        timestamp: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        raw: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        transport: z.ZodOptional<z.ZodLiteral<"http">>;
    }, z.core.$strip>;
    ExistsResultSchema: z.ZodObject<{
        exists: z.ZodBoolean;
        canReceive: z.ZodBoolean;
        reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        raw: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strip>;
    StatusResultSchema: z.ZodObject<{
        status: z.ZodEnum<{
            connected: "connected";
            connecting: "connecting";
            disconnected: "disconnected";
            qr_required: "qr_required";
            pending: "pending";
            failed: "failed";
        }>;
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
    }, z.core.$strip>;
    WhatsAppCanonicalErrorCodeSchema: z.ZodEnum<{
        INSTANCE_NOT_CONNECTED: "INSTANCE_NOT_CONNECTED";
        INVALID_TO: "INVALID_TO";
        RATE_LIMITED: "RATE_LIMITED";
        BROKER_TIMEOUT: "BROKER_TIMEOUT";
        UNSUPPORTED_OPERATION: "UNSUPPORTED_OPERATION";
        TRANSPORT_NOT_CONFIGURED: "TRANSPORT_NOT_CONFIGURED";
        UNKNOWN_ERROR: "UNKNOWN_ERROR";
    }>;
    WhatsAppCanonicalErrorSchema: z.ZodObject<{
        code: z.ZodEnum<{
            INSTANCE_NOT_CONNECTED: "INSTANCE_NOT_CONNECTED";
            INVALID_TO: "INVALID_TO";
            RATE_LIMITED: "RATE_LIMITED";
            BROKER_TIMEOUT: "BROKER_TIMEOUT";
            UNSUPPORTED_OPERATION: "UNSUPPORTED_OPERATION";
            TRANSPORT_NOT_CONFIGURED: "TRANSPORT_NOT_CONFIGURED";
            UNKNOWN_ERROR: "UNKNOWN_ERROR";
        }>;
        message: z.ZodString;
        retryable: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    CANONICAL_ERRORS: Record<"INSTANCE_NOT_CONNECTED" | "INVALID_TO" | "RATE_LIMITED" | "BROKER_TIMEOUT" | "UNSUPPORTED_OPERATION" | "TRANSPORT_NOT_CONFIGURED" | "UNKNOWN_ERROR", {
        code: "INSTANCE_NOT_CONNECTED" | "INVALID_TO" | "RATE_LIMITED" | "BROKER_TIMEOUT" | "UNSUPPORTED_OPERATION" | "TRANSPORT_NOT_CONFIGURED" | "UNKNOWN_ERROR";
        message: string;
        retryable?: boolean;
    }>;
    resolveCanonicalError: (code: WhatsAppCanonicalErrorCode | string | null | undefined) => WhatsAppCanonicalError | null;
    WhatsAppTransportError: typeof WhatsAppTransportError;
    normalizeQrPayload: (value: unknown) => import("./qr").NormalizedQrPayload;
};
export { normalizeQrPayload };
export type { SendTextInput as SendTextInputV1, SendMediaInput as SendMediaInputV1, SendResult as SendResultV1, ExistsResult as ExistsResultV1, StatusResult as StatusResultV1, WhatsAppCanonicalError as WhatsAppCanonicalErrorV1, WhatsAppCanonicalErrorCode as WhatsAppCanonicalErrorCodeV1 };
