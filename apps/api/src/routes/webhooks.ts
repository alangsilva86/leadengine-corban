import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../config/logger';

const router: Router = Router();

// POST /api/webhooks/whatsapp - Webhook do WhatsApp
router.post(
  '/whatsapp',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body;
    
    logger.info('WhatsApp webhook received', { payload });

    // TODO: Processar webhook do WhatsApp
    // - Verificar assinatura
    // - Processar mensagens recebidas
    // - Atualizar status de mensagens
    // - Criar/atualizar tickets
    
    res.json({
      success: true,
      message: 'Webhook processed',
    });
  })
);

// GET /api/webhooks/whatsapp - Verificação do webhook (Meta)
router.get(
  '/whatsapp',
  asyncHandler(async (req: Request, res: Response) => {
    const mode = typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : undefined;
    const token =
      typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : undefined;
    const challenge =
      typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : undefined;

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'your-verify-token';

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('WhatsApp webhook verified');
      res.status(200).send(challenge ?? '');
    } else {
      logger.warn('WhatsApp webhook verification failed');
      res.status(403).send('Forbidden');
    }
  })
);

// POST /api/webhooks/telephony - Webhook da URA/Telefonia
router.post(
  '/telephony',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body;
    
    logger.info('Telephony webhook received', { payload });

    // TODO: Processar webhook da URA
    
    res.json({
      success: true,
      message: 'Webhook processed',
    });
  })
);

// POST /api/webhooks/email - Webhook de email
router.post(
  '/email',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body;
    
    logger.info('Email webhook received', { payload });

    // TODO: Processar webhook de email
    
    res.json({
      success: true,
      message: 'Webhook processed',
    });
  })
);

export { router as webhooksRouter };
