import { body } from 'express-validator';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { suggestWithAi } from '../services/ai/openai-client';
import { recordAiSuggestion } from '@ticketz/storage';
import { logger } from '../../config/logger';
import { isAiEnabled } from '../../config/ai';
import { ensureAiConfig, defaultSuggestionSchema } from './config-controller';
import { readQueueParam } from './utils';
import type { Request, Response } from 'express';

const suggestValidators = [
  body('conversationId').isString().notEmpty(),
  body('goal').optional({ nullable: true }).isString(),
  body('lastMessages').optional().isArray(),
  body('leadProfile').optional({ nullable: true }).isObject(),
  body('queueId').optional({ nullable: true }).isString(),
];

export const suggestMiddlewares = [
  requireTenant,
  ...suggestValidators,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId!;
    const { conversationId, goal, lastMessages = [], leadProfile } = req.body as {
      conversationId: string;
      goal?: string;
      lastMessages?: Array<{ role?: string; content?: string }>;
      leadProfile?: Record<string, unknown>;
    };

    const queueId = readQueueParam(req);
    const config = await ensureAiConfig(tenantId, queueId);

    const contextPieces: string[] = [];
    if (leadProfile) {
      contextPieces.push(`Perfil do lead: ${JSON.stringify(leadProfile)}`);
    }

    const historyText = lastMessages
      .map((message) => `${message.role ?? 'user'}: ${message.content ?? ''}`)
      .join('\n');

    const promptParts = [
      goal ?? 'Gerar nota interna com próximos passos e recomendações.',
      historyText,
      contextPieces.join('\n'),
    ].filter(Boolean);

    const prompt = promptParts.join('\n\n');

    const aiResult = await suggestWithAi({
      tenantId,
      conversationId,
      configId: config.id,
      prompt,
      contextMessages: lastMessages
        .filter((message): message is { role: 'user' | 'assistant' | 'system'; content: string } =>
          Boolean(message.content)
        )
        .map((message) => ({
          role: (message.role as 'user' | 'assistant' | 'system') ?? 'user',
          content: message.content ?? '',
        })),
      structuredSchema: config.structuredOutputSchema ?? defaultSuggestionSchema,
      metadata: {
        tenantId,
        conversationId,
        goal,
      },
    });

    await recordAiSuggestion({
      tenantId,
      conversationId,
      configId: config.id,
      payload: aiResult.payload,
      confidence: aiResult.confidence ?? null,
    });

    logger.info('crm.ai.suggest.completed', {
      tenantId,
      conversationId,
      model: aiResult.model,
      confidence: aiResult.confidence,
    });

    return res.json({
      success: true,
      data: {
        suggestion: aiResult.payload,
        confidence: aiResult.confidence ?? null,
        model: aiResult.model,
        usage: aiResult.usage,
        aiEnabled: isAiEnabled,
      },
    });
  }),
];
