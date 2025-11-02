import { createHash } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { isMvpAuthBypassEnabled } from '../config/feature-flags';
import { isDatabaseEnabled, prisma } from '../lib/prisma';
import { ensureTenantRecord } from '../services/tenant-service';

type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT';

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

const MVP_AUTH_BYPASS_ENABLED = isMvpAuthBypassEnabled();

const DEFAULT_AUTH_MVP_USER_ID = '00000000-0000-4000-8000-000000000001';

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const resolveBypassUserId = (): string => {
  const raw = process.env.AUTH_MVP_USER_ID?.trim();
  if (!raw) {
    return DEFAULT_AUTH_MVP_USER_ID;
  }

  if (isUuid(raw)) {
    return raw;
  }

  logger.warn('[Auth] AUTH_MVP_USER_ID não é um UUID válido; usando fallback default', {
    provided: raw,
  });
  return DEFAULT_AUTH_MVP_USER_ID;
};

const AUTH_MVP_USER_ID = resolveBypassUserId();
const AUTH_MVP_TENANT_ID = process.env.AUTH_MVP_TENANT_ID || 'demo-tenant';
const AUTH_MVP_USER_NAME = process.env.AUTH_MVP_USER_NAME || 'MVP Anonymous';
const AUTH_MVP_USER_EMAIL =
  process.env.AUTH_MVP_USER_EMAIL || 'mvp-anonymous@leadengine.local';
const AUTH_MVP_ROLE = (process.env.AUTH_MVP_ROLE || 'ADMIN') as UserRole;
const AUTH_MVP_PASSWORD_HASH = createHash('sha256')
  .update(process.env.AUTH_MVP_PASSWORD || 'mvp-bypass')
  .digest('hex');

/**
 * Define permissões baseadas no papel do usuário
 */
function getPermissionsByRole(role: UserRole): string[] {
  const permissions: Record<string, string[]> = {
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

const isProductionEnv = process.env.NODE_ENV === 'production';

const normalizeRole = (role?: string | UserRole): UserRole => {
  const normalized = (role || '').toString().trim().toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'SUPERVISOR' || normalized === 'AGENT') {
    return normalized;
  }
  return 'AGENT';
};

const buildMvpBypassUser = (): AuthenticatedUser => {
  const resolvedRole = normalizeRole(AUTH_MVP_ROLE);
  return {
    id: AUTH_MVP_USER_ID,
    tenantId: AUTH_MVP_TENANT_ID,
    email: AUTH_MVP_USER_EMAIL,
    name: AUTH_MVP_USER_NAME,
    role: resolvedRole,
    isActive: true,
    permissions: getPermissionsByRole(resolvedRole),
  };
};

export const AUTH_MVP_BYPASS_USER_ID = AUTH_MVP_USER_ID;
export const AUTH_MVP_BYPASS_TENANT_ID = AUTH_MVP_TENANT_ID;
export const AUTH_MVP_BYPASS_USER_EMAIL = AUTH_MVP_USER_EMAIL;
export const AUTH_MVP_BYPASS_USER_NAME = AUTH_MVP_USER_NAME;

/**
 * Resolve o usuário padrão utilizado no modo demonstração.
 */
export const resolveDemoUser = (): AuthenticatedUser => buildMvpBypassUser();

let ensureDemoUserPromise: Promise<void> | null = null;

const ensureDemoUserRecord = async (): Promise<void> => {
  if (!isDatabaseEnabled) {
    return;
  }

  if (!ensureDemoUserPromise) {
    const resolvedRole = normalizeRole(AUTH_MVP_ROLE);
    ensureDemoUserPromise = ensureTenantRecord(AUTH_MVP_TENANT_ID, {
      source: 'auth.ensureDemoUserRecord',
    })
      .then(() =>
        prisma.user.upsert({
          where: { id: AUTH_MVP_USER_ID },
          update: {
            tenantId: AUTH_MVP_TENANT_ID,
            email: AUTH_MVP_USER_EMAIL,
            name: AUTH_MVP_USER_NAME,
            role: resolvedRole,
            isActive: true,
            passwordHash: AUTH_MVP_PASSWORD_HASH,
          },
          create: {
            id: AUTH_MVP_USER_ID,
            tenantId: AUTH_MVP_TENANT_ID,
            email: AUTH_MVP_USER_EMAIL,
            name: AUTH_MVP_USER_NAME,
            role: resolvedRole,
            isActive: true,
            passwordHash: AUTH_MVP_PASSWORD_HASH,
            settings: {},
          },
        })
      )
      .then(() => undefined)
      .catch((error) => {
        ensureDemoUserPromise = null;
        logger.warn('[Auth] Falha ao garantir usuário demo', { error });
        throw error;
      });
  }

  await ensureDemoUserPromise;
};

const ensureUserContext = async (req: Request): Promise<AuthenticatedUser> => {
  if (!req.user) {
    await ensureDemoUserRecord();
    req.user = resolveDemoUser();
  }
  return req.user;
};

// =============================================================================
// Middleware Functions
// =============================================================================

/**
 * Middleware de autenticação (modo demo)
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    if (!MVP_AUTH_BYPASS_ENABLED && isProductionEnv) {
      logger.debug(
        '[Auth] MVP bypass desativado explicitamente, mas autenticação clássica foi removida. Aplicando usuário demo.'
      );
    }

    await ensureUserContext(req);
    next();
  } catch (error) {
    logger.error('[Auth] Erro inesperado no middleware de autenticação', {
      error,
    });
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Erro interno de autenticação',
      },
    });
  }
};

/**
 * Middleware para verificar se o usuário pertence ao tenant
 */
export const requireTenant = async (req: Request, _res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    await ensureUserContext(req);
    next();
  } catch (error) {
    next(error);
  }
};
