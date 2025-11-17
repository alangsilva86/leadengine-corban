import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Tenant, User } from '@prisma/client';
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

export const AUTH_MVP_BYPASS_TENANT_ID = process.env.AUTH_MVP_TENANT_ID || 'demo-tenant';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ACCESS_TOKEN_TYPE = 'access';

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

type TokenPayload = jwt.JwtPayload & {
  sub: string;
  tenantId: string;
  permissions?: string[];
  type?: 'access' | 'refresh';
};

const normalizeJsonObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const buildAuthenticatedUser = (
  user: User & { tenant?: Tenant | null },
  permissions?: string[]
): AuthenticatedUser => ({
  id: user.id,
  tenantId: user.tenantId,
  email: user.email,
  name: user.name,
  role: user.role as UserRole,
  isActive: user.isActive,
  permissions: permissions && permissions.length ? permissions : getPermissionsByRole(user.role as UserRole),
  tenant: user.tenant
    ? {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        settings: normalizeJsonObject(user.tenant.settings),
      }
    : undefined,
});

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

const fetchUserFromDatabase = async (userId: string, tenantId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenant: true,
    },
  }).then((user) => {
    if (!user) {
      return null;
    }

    if (!user.isActive || user.tenantId !== tenantId) {
      return null;
    }

    if (!user.tenant || !user.tenant.isActive) {
      return null;
    }

    return user;
  });

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

    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;

    if (!payload.sub || !payload.tenantId) {
      return respondUnauthorized(res);
    }

    if (payload.type && payload.type !== ACCESS_TOKEN_TYPE) {
      return respondForbidden(res, 'Token não é do tipo de acesso');
    }

    const userRecord = await fetchUserFromDatabase(payload.sub, payload.tenantId);

    if (!userRecord) {
      return respondUnauthorized(res, 'Usuário não encontrado ou inativo');
    }

    req.user = buildAuthenticatedUser(userRecord, payload.permissions);
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
