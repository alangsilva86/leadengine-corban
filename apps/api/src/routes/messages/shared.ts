import type { Request, Response } from 'express';
import { ZodError, type z } from 'zod';

import { normalizePayload, type MessagePayloadInput } from '@ticketz/contracts';

import { respondWithValidationError } from '../../utils/http-validation';

export type NormalizedMessagePayload = ReturnType<typeof normalizePayload>;

/** Schemas de envio (SendByTicketSchema, SendByContactSchema…): todos produzem `payload` e, às vezes, `idempotencyKey`. */
type MessageSendSchema = z.ZodType<{ payload: MessagePayloadInput; idempotencyKey?: string | undefined }>;

export interface ValidateMessageSendRequestResult<TSchema extends MessageSendSchema> {
  parsed: z.infer<TSchema>;
  payload: NormalizedMessagePayload;
  idempotencyKey?: string | undefined;
}

export interface ValidateMessageSendRequestContext<TSchema extends MessageSendSchema>
  extends ValidateMessageSendRequestResult<TSchema> {
  req: Request;
  res: Response;
  headerIdempotencyKey?: string | undefined;
  trimmedHeaderIdempotencyKey?: string | undefined;
}

export interface ValidateMessageSendRequestOptions<TSchema extends MessageSendSchema> {
  schema: TSchema;
  req: Request;
  res: Response;
  onValid?: (
    context: ValidateMessageSendRequestContext<TSchema>
  ) => Promise<boolean | void> | boolean | void;
}

export const validateMessageSendRequest = async <TSchema extends MessageSendSchema>({
  schema,
  req,
  res,
  onValid,
}: ValidateMessageSendRequestOptions<TSchema>): Promise<ValidateMessageSendRequestResult<TSchema> | null> => {
  let parsed: z.infer<TSchema>;
  try {
    parsed = schema.parse(req.body ?? {});
  } catch (error) {
    if (error instanceof ZodError) {
      respondWithValidationError(res, error.issues);
      return null;
    }
    throw error;
  }

  const payload = normalizePayload(parsed.payload);
  const headerIdempotencyKey = req.get('Idempotency-Key') ?? undefined;
  const trimmedHeaderIdempotencyKey = headerIdempotencyKey?.trim() || undefined;
  const idempotencyKey = parsed.idempotencyKey ?? headerIdempotencyKey ?? undefined;

  if (onValid) {
    const shouldContinue = await onValid({
      req,
      res,
      parsed,
      payload,
      idempotencyKey,
      headerIdempotencyKey,
      trimmedHeaderIdempotencyKey,
    });

    if (shouldContinue === false) {
      return null;
    }
  }

  return { parsed, payload, idempotencyKey };
};
