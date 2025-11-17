import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Tenant, User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import {
  authMiddleware,
  getPermissionsByRole,
  requireTenant,
  type AuthenticatedUser,
  type UserRole,
} from '../middleware/auth';

const router: Router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_TOKEN_TTL || '7d';

const normalizeJson = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const normalizeSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'tenant';

const normalizeRoleInput = (value?: string | null): UserRole => {
  const normalized = (value ?? '').toString().trim().toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'SUPERVISOR' || normalized === 'AGENT') {
    return normalized;
  }
  return 'AGENT';
};

const buildUserProfile = (
  user: User,
  tenant: Tenant,
  permissions: string[]
): AuthenticatedUser & {
  settings: Record<string, unknown>;
} => ({
  id: user.id,
  tenantId: tenant.id,
  email: user.email,
  name: user.name,
  role: user.role as UserRole,
  isActive: user.isActive,
  permissions,
  tenant: {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    settings: normalizeJson(tenant.settings),
  },
  settings: normalizeJson(user.settings),
});

const signToken = (
  user: User,
  tenant: Tenant,
  permissions: string[],
  type: 'access' | 'refresh'
): string =>
  jwt.sign(
    {
      sub: user.id,
      tenantId: tenant.id,
      permissions,
      type,
    },
    JWT_SECRET,
    { expiresIn: type === 'access' ? ACCESS_TOKEN_EXPIRES_IN : REFRESH_TOKEN_EXPIRES_IN }
  );

export const buildSessionPayload = (user: User, tenant: Tenant, permissions: string[]) => ({
  token: {
    accessToken: signToken(user, tenant, permissions, 'access'),
    refreshToken: signToken(user, tenant, permissions, 'refresh'),
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  },
  user: buildUserProfile(user, tenant, permissions),
});

const respondWithSession = (res: Response, session: ReturnType<typeof buildSessionPayload>) => {
  res.json({
    success: true,
    data: session,
  });
};

const handleAuthError = (res: Response, message: string, status = 401) =>
  res.status(status).json({
    success: false,
    error: {
      code: status === 401 ? 'INVALID_CREDENTIALS' : 'AUTH_ERROR',
      message,
    },
  });

router.post('/login', async (req: Request, res: Response) => {
  const { email, password, tenantSlug } = req.body ?? {};

  if (!email || !password || !tenantSlug) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'Credenciais e tenant são obrigatórios.',
      },
    });
  }

  try {
    const slug = normalizeSlug(tenantSlug);
    const tenant = await prisma.tenant.findUnique({ where: { slug } });

    if (!tenant || !tenant.isActive) {
      return handleAuthError(res, 'Tenant inexistente ou inativo.');
    }

    const user = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: normalizeEmail(email) },
    });

    if (!user || !user.passwordHash || !user.isActive) {
      return handleAuthError(res, 'Credenciais inválidas.');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      return handleAuthError(res, 'Credenciais inválidas.');
    }

    const permissions = getPermissionsByRole(user.role as UserRole);

    respondWithSession(res, buildSessionPayload(user, tenant, permissions));
  } catch (error) {
    logger.error('[Auth] Falha ao executar login', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_LOGIN_FAILED',
        message: 'Não foi possível autenticar no momento.',
      },
    });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, tenantName, tenantSlug, role } = req.body ?? {};

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'Nome, e-mail e senha são obrigatórios.',
      },
    });
  }

  try {
    const slugInput = tenantSlug || tenantName;
    if (!slugInput) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Informe o tenant desejado ou o nome para criação.',
        },
      });
    }

    const slug = normalizeSlug(slugInput);
    let tenant = await prisma.tenant.findUnique({ where: { slug } });
    let isNewTenant = false;

    if (!tenant) {
      if (!tenantName) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'Nome do tenant é obrigatório para criação.',
          },
        });
      }

      tenant = await prisma.tenant.create({
        data: {
          id: slug,
          name: tenantName.trim(),
          slug,
          isActive: true,
          settings: {},
        },
      });
      isNewTenant = true;
    }

    const normalizedEmail = normalizeEmail(email);

    const existingUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'Usuário já cadastrado para este tenant.',
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const resolvedRole = isNewTenant ? 'ADMIN' : normalizeRoleInput(role);

    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: normalizedEmail,
        name: name.trim(),
        role: resolvedRole,
        isActive: true,
        passwordHash,
        settings: {},
      },
    });

    const permissions = getPermissionsByRole(user.role as UserRole);

    respondWithSession(res, buildSessionPayload(user, tenant, permissions));
  } catch (error) {
    logger.error('[Auth] Falha ao registrar usuário', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_REGISTER_FAILED',
        message: 'Não foi possível concluir o registro agora.',
      },
    });
  }
});

router.post('/token/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'Refresh token é obrigatório.',
      },
    });
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET) as jwt.JwtPayload & {
      sub: string;
      tenantId: string;
      permissions?: string[];
      type?: string;
    };

    if (!payload.sub || !payload.tenantId || payload.type !== 'refresh') {
      return handleAuthError(res, 'Refresh token inválido.');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user || !user.tenant) {
      return handleAuthError(res, 'Usuário não encontrado.');
    }

    if (!user.isActive || !user.tenant.isActive || user.tenant.id !== payload.tenantId) {
      return handleAuthError(res, 'Sessão inválida.');
    }

    const permissions = payload.permissions?.length
      ? payload.permissions
      : getPermissionsByRole(user.role as UserRole);

    respondWithSession(res, buildSessionPayload(user, user.tenant, permissions));
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return handleAuthError(res, 'Refresh token expirado.');
    }

    logger.error('[Auth] Falha ao renovar token', { error });
    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_INVALID',
        message: 'Refresh token inválido.',
      },
    });
  }
});

router.get('/me', authMiddleware, requireTenant, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { tenant: true },
    });

    if (!user || !user.tenant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuário não encontrado.',
        },
      });
    }

    const permissions = getPermissionsByRole(user.role as UserRole);
    res.json({ success: true, data: buildUserProfile(user, user.tenant, permissions) });
  } catch (error) {
    logger.error('[Auth] Falha ao recuperar o perfil', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_PROFILE_FAILED',
        message: 'Não foi possível carregar o perfil.',
      },
    });
  }
});

export const authRouter = router;
