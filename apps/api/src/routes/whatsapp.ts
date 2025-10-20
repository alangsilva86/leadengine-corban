import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { saveWhatsAppMedia } from '../services/whatsapp-media-service';

const DEFAULT_UPLOAD_LIMIT = 25 * 1024 * 1024;
const configuredLimit = Number(process.env.WHATSAPP_UPLOAD_MAX_BYTES);
const resolvedUploadLimit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : DEFAULT_UPLOAD_LIMIT;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: resolvedUploadLimit,
  },
});

const router: Router = Router();

router.post(
  '/uploads',
  requireTenant,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        error: {
          code: 'FILE_REQUIRED',
          message: 'Arquivo obrigatório para upload.',
        },
      });
      return;
    }

    const descriptor = await saveWhatsAppMedia({
      buffer: file.buffer,
      tenantId: req.user?.tenantId ?? undefined,
      originalName:
        typeof req.body?.fileName === 'string' && req.body.fileName.length > 0
          ? req.body.fileName
          : file.originalname,
      mimeType:
        typeof req.body?.mimeType === 'string' && req.body.mimeType.length > 0
          ? req.body.mimeType
          : file.mimetype,
    });

    res.status(201).json({
      success: true,
      data: descriptor,
    });
  })
);

export const whatsappRouter = router;

export default router;
