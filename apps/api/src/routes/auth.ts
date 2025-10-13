import { Router, type Request, type Response } from 'express';
import { authMiddleware, resolveDemoUser } from '../middleware/auth';
import { logger } from '../config/logger';
import { isMvpAuthBypassEnabled } from '../config/feature-flags';

const MVP_BYPASS_TENANT_NAME = process.env.AUTH_MVP_TENANT_NAME?.trim() || 'Demo Tenant';
const MVP_BYPASS_TENANT_SLUG =
  process.env.AUTH_MVP_TENANT_SLUG?.trim() || process.env.AUTH_MVP_TENANT_ID || 'demo-tenant';

const router: Router = Router();

const buildDemoProfile = () => {
  const user = resolveDemoUser();
  const nowIso = new Date().toISOString();

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: null,
    avatar: null,
    role: user.role,
    isActive: true,
    settings: {},
    lastLoginAt: nowIso,
    createdAt: nowIso,
    permissions: user.permissions,
    tenant: {
      id: user.tenantId,
      name: MVP_BYPASS_TENANT_NAME,
      slug: MVP_BYPASS_TENANT_SLUG,
      settings: {},
    },
  };
};

const sendDemoSession = (res: Response) => {
  const user = resolveDemoUser();
  logger.info('[Auth] Sessão demo utilizada');

  res.json({
    success: true,
    mode: 'demo',
    token: null,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      permissions: user.permissions,
    },
    tenant: {
      id: user.tenantId,
      name: MVP_BYPASS_TENANT_NAME,
      slug: MVP_BYPASS_TENANT_SLUG,
    },
  });
};

/**
 * POST /api/auth/login - Autenticação fictícia para o modo demo
 */
router.post('/login', (_req: Request, res: Response) => {
  logger.info('[Auth] POST /login (modo demo)');
  sendDemoSession(res);
});

/**
 * POST /api/auth/register - Desnecessário no modo demo
 */
router.post('/register', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Registro não é necessário no modo demonstração.',
  });
});

/**
 * GET /api/auth/me - Dados do usuário demo
 */
router.get('/me', authMiddleware, (_req: Request, res: Response) => {
  logger.info('[Auth] GET /me (modo demo)');
  res.json({
    success: true,
    data: buildDemoProfile(),
    bypassEnabled: isMvpAuthBypassEnabled(),
  });
});

/**
 * PUT /api/auth/profile - Atualização superficial sem persistência
 */
router.put('/profile', authMiddleware, (req: Request, res: Response) => {
  logger.info('[Auth] PUT /profile (modo demo)');

  const currentProfile = buildDemoProfile();
  const updates: Partial<typeof currentProfile> = {};

  if (typeof req.body?.name === 'string' && req.body.name.trim()) {
    updates.name = req.body.name.trim();
  }
  if (typeof req.body?.phone === 'string' && req.body.phone.trim()) {
    updates.phone = req.body.phone.trim();
  }
  if (typeof req.body?.avatar === 'string' && req.body.avatar.trim()) {
    updates.avatar = req.body.avatar.trim();
  }
  if (req.body?.settings && typeof req.body.settings === 'object') {
    updates.settings = req.body.settings;
  }

  res.json({
    success: true,
    data: {
      ...currentProfile,
      ...updates,
    },
    message: 'Perfil atualizado localmente (modo demonstração). Nenhuma alteração foi persistida.',
  });
});

/**
 * PUT /api/auth/password - Sem efeito no modo demo
 */
router.put('/password', authMiddleware, (_req: Request, res: Response) => {
  logger.info('[Auth] PUT /password (modo demo)');
  res.json({
    success: true,
    message: 'A alteração de senha é desnecessária no modo demonstração.',
  });
});

export const authRouter = router;
