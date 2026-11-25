import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Tenant, User } from '@prisma/client';
import { getJwtSecret } from '../config/auth';
import { logger } from '../config/logger';
import { prisma } from '../lib/prisma';

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT';

// =============================================================================
// Types
// =============================================================================

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  permissions: string[];
  tenant?: {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, unknown>;
  };
}

// Estender o tipo Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// =============================================================================
// Utilities
// =============================================================================

export function getPermissionsByRole(role: UserRole): string[] {
  const permissions: Record<UserRole, string[]> = {
    ADMIN: [
      'users:read',
      'users:write',
      'users:delete',
      'tenants:read',
      'tenants:write',
      'tickets:read',
      'tickets:write',
      'tickets:delete',
      'leads:read',
      'leads:write',
      'leads:delete',
      'campaigns:read',
      'campaigns:write',
      'campaigns:delete',
      'reports:read',
      'settings:read',
      'settings:write',
    ],
    SUPERVISOR: [
      'users:read',
      'tickets:read',
      'tickets:write',
      'leads:read',
      'leads:write',
      'campaigns:read',
      'campaigns:write',
      'reports:read',
      'settings:read',
    ],
    AGENT: [
      'tickets:read',
      'tickets:write',
      'leads:read',
      'leads:write',
      'campaigns:read',
    ],
  };

  return permissions[role] || [];
}

export type SessionClaims = jwt.JwtPayload & {
  sub: string;
  tenantId: string;
  sid: string;
  exp: number;
  type: 'access' | 'refresh';
};

export const verifySessionToken = (token: string, type: SessionClaims['type']): SessionClaims => {
  const claims = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  if (
    typeof claims === 'string' || claims.type !== type || typeof claims.exp !== 'number' ||
    typeof claims.sub !== 'string' || !claims.sub || typeof claims.tenantId !== 'string' ||
    !claims.tenantId || typeof claims.sid !== 'string' || !claims.sid
  ) {
    throw new jwt.JsonWebTokenError('Invalid session claims');
  }
  return claims as SessionClaims;
};

export const findActiveSession = (claims: SessionClaims) => prisma.authSession.findFirst({
  where: {
    id: claims.sid,
    userId: claims.sub,
    expiresAt: { gt: new Date() },
    user: { tenantId: claims.tenantId, isActive: true, tenant: { isActive: true } },
  },
  include: { user: { include: { tenant: true } } },
});

const normalizeJsonObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const buildAuthenticatedUser = (
  user: User & { tenant?: Tenant | null },
): AuthenticatedUser => {
  const authenticated: AuthenticatedUser = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    isActive: user.isActive,
    permissions: getPermissionsByRole(user.role as UserRole),
  };

  if (user.tenant) {
    authenticated.tenant = {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      settings: normalizeJsonObject(user.tenant.settings),
    };
  }

  return authenticated;
};

const respondUnauthorized = (res: Response, message = 'Token inválido ou ausente', code = 'UNAUTHORIZED') =>
  res.status(401).json({
    success: false,
    error: {
      code,
      message,
    },
  });

const respondForbidden = (res: Response, message = 'Acesso negado para este tenant', code = 'FORBIDDEN') =>
  res.status(403).json({
    success: false,
    error: {
      code,
      message,
    },
  });

export const authenticateAccessToken = async (token: string) => {
  const claims = verifySessionToken(token, 'access');
  const session = await findActiveSession(claims);
  return session ? { user: buildAuthenticatedUser(session.user), claims } : null;
};

// =============================================================================
// Middleware Functions
// =============================================================================

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return respondUnauthorized(res);
    }

    const token = authorization.replace('Bearer ', '').trim();
    if (!token) {
      return respondUnauthorized(res);
    }

    const session = await authenticateAccessToken(token);
    if (!session) {
      return respondUnauthorized(res, 'Sessão não encontrada ou revogada.');
    }

    req.user = session.user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return respondUnauthorized(res, 'Token expirado', 'TOKEN_EXPIRED');
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return respondUnauthorized(res, 'Token inválido', 'TOKEN_INVALID');
    }

    logger.error('[Auth] Erro inesperado no middleware de autenticação', { error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Erro interno de autenticação',
      },
    });
  }
};

export const requireTenant = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  if (!req.user) {
    return respondUnauthorized(res);
  }

  if (!req.user.isActive) {
    return respondForbidden(res, 'Usuário inativo');
  }

  if (!req.user.tenantId) {
    return respondForbidden(res, 'Tenant não configurado');
  }

  next();
};
