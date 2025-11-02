import { Router, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';

import { asyncHandler } from '../middleware/error-handler';
import { respondWithValidationError } from '../utils/http-validation';
import { getCurrentAiMode, updateAiMode } from '../services/ai/mode-service';
import { generateAiReply } from '../services/ai/reply-service';
import { generateAiSuggestions } from '../services/ai/suggestion-service';
import { upsertConversationMemory } from '../services/ai/memory-service';
import {
  AiConversationMessageSchema,
  AiModeSchema,
} from '../services/ai/types';

const router: Router = Router();

const ensureUser = (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Autenticação obrigatória para recursos de IA.',
      },
    });
    return null;
  }
  return req.user;
};

const updateModeSchema = z
  .object({
    mode: AiModeSchema,
    updatedBy: z.string().optional(),
  })
  .strict();

router.get(
  '/mode',
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureUser(req, res);
    if (!user) {
      return;
    }

    const payload = await getCurrentAiMode(user.tenantId);
    res.json({
      success: true,
      data: payload,
    });
  })
);

router.post(
  '/mode',
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureUser(req, res);
    if (!user) {
      return;
    }

    let parsed;
    try {
      parsed = updateModeSchema.parse(req.body ?? {});
    } catch (error) {
      if (error instanceof ZodError) {
        respondWithValidationError(res, error.issues);
        return;
      }
      throw error;
    }

    const payload = await updateAiMode({
      tenantId: user.tenantId,
      mode: parsed.mode,
      updatedBy: parsed.updatedBy ?? user.id,
    });

    res.json({
      success: true,
      data: payload,
    });
  })
);

const replySchema = z
  .object({
    ticketId: z.string().min(1),
    contactId: z.string().min(1),
    prompt: z.string().min(1),
    conversation: z.array(AiConversationMessageSchema).default([]),
    mode: AiModeSchema.optional(),
  })
  .strict();

router.post(
  '/reply',
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureUser(req, res);
    if (!user) {
      return;
    }

    let parsed;
    try {
      parsed = replySchema.parse(req.body ?? {});
    } catch (error) {
      if (error instanceof ZodError) {
        respondWithValidationError(res, error.issues);
        return;
      }
      throw error;
    }

    const mode = parsed.mode ?? (await getCurrentAiMode(user.tenantId)).mode;
    const result = await generateAiReply({
      tenantId: user.tenantId,
      ticketId: parsed.ticketId,
      contactId: parsed.contactId,
      prompt: parsed.prompt,
      conversation: parsed.conversation,
      mode,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

const suggestionSchema = z
  .object({
    ticketId: z.string().min(1),
    contactId: z.string().min(1),
    conversation: z.array(AiConversationMessageSchema).default([]),
    limit: z.number().int().min(1).max(5).optional(),
  })
  .strict();

router.post(
  '/suggest',
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureUser(req, res);
    if (!user) {
      return;
    }

    let parsed;
    try {
      parsed = suggestionSchema.parse(req.body ?? {});
    } catch (error) {
      if (error instanceof ZodError) {
        respondWithValidationError(res, error.issues);
        return;
      }
      throw error;
    }

    const result = await generateAiSuggestions({
      tenantId: user.tenantId,
      ticketId: parsed.ticketId,
      contactId: parsed.contactId,
      conversation: parsed.conversation,
      limit: parsed.limit,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

const memorySchema = z
  .object({
    contactId: z.string().min(1),
    topic: z.string().min(1),
    content: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
    ttlSeconds: z.number().int().positive().max(86_400).optional(),
  })
  .strict();

router.post(
  '/memory/upsert',
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureUser(req, res);
    if (!user) {
      return;
    }

    let parsed;
    try {
      parsed = memorySchema.parse(req.body ?? {});
    } catch (error) {
      if (error instanceof ZodError) {
        respondWithValidationError(res, error.issues);
        return;
      }
      throw error;
    }

    const memory = await upsertConversationMemory({
      tenantId: user.tenantId,
      contactId: parsed.contactId,
      topic: parsed.topic,
      content: parsed.content,
      metadata: parsed.metadata ?? null,
      ttlSeconds: parsed.ttlSeconds,
    });

    res.json({
      success: true,
      data: memory,
    });
  })
);

export { router as aiRouter };
