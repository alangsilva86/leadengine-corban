import type { Request, Response } from 'express';
import { ZodError, type z } from 'zod';

import { normalizePayload } from '@ticketz/contracts';

import { respondWithValidationError } from '../../utils/http-validation';

export type NormalizedMessagePayload = ReturnType<typeof normalizePayload>;

export interface ValidateMessageSendRequestResult<TSchema extends z.ZodTypeAny> {
  parsed: z.infer<TSchema>;
  payload: NormalizedMessagePayload;
  idempotencyKey?: string;
}

export interface ValidateMessageSendRequestContext<TSchema extends z.ZodTypeAny>
  extends ValidateMessageSendRequestResult<TSchema> {
  req: Request;
  res: Response;
  headerIdempotencyKey?: string;
  trimmedHeaderIdempotencyKey?: string;
}

export interface ValidateMessageSendRequestOptions<TSchema extends z.ZodTypeAny> {
  schema: TSchema;
  req: Request;
  res: Response;
  onValid?: (
    context: ValidateMessageSendRequestContext<TSchema>
  ) => Promise<boolean | void> | boolean | void;
}

export const validateMessageSendRequest = async <TSchema extends z.ZodTypeAny>({
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
