import { Router, type Request, type Response } from 'express';
import { body } from 'express-validator';

import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { logger } from '../../config/logger';
import { streamReply } from './reply-streamer';
import { readQueueParam, ensureTenantId } from './utils';

const router: Router = Router();

const replyValidators = [
  body('conversationId').isString().notEmpty(),
  body('messages')
    .isArray({ min: 1 })
    .withMessage('messages deve ser um array com pelo menos uma mensagem.'),
  body('messages.*.role')
    .isIn(['user', 'assistant', 'system'])
    .withMessage('role deve ser user, assistant ou system.'),
  body('messages.*.content')
    .isString()
    .notEmpty()
    .withMessage('content deve ser texto não vazio.'),
  body('metadata').optional({ nullable: true }).isObject(),
  body('queueId').optional({ nullable: true }).isString(),
];

router.post(
  '/reply',
  requireTenant,
  replyValidators,
  validateRequest,
  (req: Request, res: Response) => {
    const tenantId = ensureTenantId(req);
    const { conversationId, messages, metadata = {} } = req.body as {
      conversationId: string;
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      metadata?: Record<string, unknown>;
    };

    const queueId = readQueueParam(req);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    (res as any).flushHeaders?.();

    const sendEvent = (event: string, data: unknown) => {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      res.write(`event: ${event}\n`);
      res.write(`data: ${payload}\n\n`);
    };

    const abortController = new AbortController();
    const signal = abortController.signal;
    let aborted = false;

    req.on('close', () => {
      if (!abortController.signal.aborted) {
        aborted = true;
        abortController.abort();
      }
    });

    streamReply({
      tenantId,
      queueId,
      conversationId,
      messages,
      metadata,
      signal,
      sendEvent,
      onComplete: () => {
        if (!res.headersSent || res.writableEnded) {
          return;
        }
        res.end();
      },
      isAborted: () => aborted,
    }).catch((error) => {
      logger.error('crm.ai.reply.failed', {
        tenantId,
        conversationId,
        error,
      });
      if (!res.headersSent || !res.writableEnded) {
        sendEvent('error', {
          message: (error as Error).message,
        });
        res.end();
      }
    });
  }
);

export { router as replyRouter };
