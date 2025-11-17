import { Router, type Request, type Response } from 'express';
import multer from 'multer';

import { asyncHandler } from '../middleware/error-handler';
import { saveWhatsAppMedia } from '../services/whatsapp-media-service';
import { normalizeString } from '../utils/request-parsers';

const router: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

const ensureAuthenticatedUser = (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Autenticação obrigatória.',
      },
    });
    return null;
  }

  if (!req.user.tenantId) {
    res.status(403).json({
      success: false,
      error: {
        code: 'TENANT_REQUIRED',
        message: 'Tenant obrigatório para efetuar upload.',
      },
    });
    return null;
  }

  return req.user;
};

router.post(
  '/whatsapp/uploads',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const file = req.file;

    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'FILE_REQUIRED',
          message: 'Arquivo obrigatório para upload.',
        },
      });
      return;
    }

    const explicitFileName = normalizeString(req.body?.fileName) ?? undefined;
    const explicitMimeType = normalizeString(req.body?.mimeType) ?? undefined;
    const ticketId = normalizeString(req.body?.ticketId) ?? undefined;
    const contactId = normalizeString(req.body?.contactId) ?? undefined;
    const instanceId = normalizeString(req.body?.instanceId) ?? undefined;
    const messageId = normalizeString(req.body?.messageId) ?? undefined;

    const originalName = explicitFileName ?? normalizeString(file.originalname) ?? undefined;
    const mimeType = explicitMimeType ?? normalizeString(file.mimetype) ?? undefined;

    const descriptor = await saveWhatsAppMedia({
      buffer: file.buffer,
      tenantId: user.tenantId,
      instanceId: instanceId ?? undefined,
      chatId: ticketId ?? contactId ?? undefined,
      messageId: messageId ?? undefined,
      originalName,
      mimeType,
    });

    res.status(201).json({
      mediaUrl: descriptor.mediaUrl,
      expiresInSeconds: descriptor.expiresInSeconds,
      mimeType: mimeType ?? 'application/octet-stream',
      mediaMimeType: mimeType ?? 'application/octet-stream',
      fileName: originalName ?? 'upload.bin',
      mediaFileName: originalName ?? 'upload.bin',
      size: typeof file.size === 'number' ? file.size : file.buffer.length,
      mediaSize: typeof file.size === 'number' ? file.size : file.buffer.length,
      ticketId: ticketId ?? null,
      contactId: contactId ?? null,
    });
  })
);

export { router as whatsappUploadsRouter };
