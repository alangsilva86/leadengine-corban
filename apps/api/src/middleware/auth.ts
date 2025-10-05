import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { isMvpAuthBypassEnabled } from '../config/feature-flags';

type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT';

// ============================================================================
// Types
// ============================================================================

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  permissions: string[];
}

export interface JWTPayload {
  id: string;
  tenantId?: string;
  email?: string;
  name?: string;
  role?: string | UserRole;
  permissions?: string[];
  iat?: number;
  exp?: number;
  __verifiedWithDemoSecret?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantId?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string;
  };
  expiresIn: string;
}

// Estender o tipo Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// ============================================================================
// Utilities
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const DEMO_JWT_SECRET = process.env.DEMO_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const MVP_AUTH_BYPASS_ENABLED = isMvpAuthBypassEnabled();
const AUTH_MVP_USER_ID = process.env.AUTH_MVP_USER_ID || 'mvp-anonymous';
const AUTH_MVP_TENANT_ID = process.env.AUTH_MVP_TENANT_ID || 'demo-tenant';
const AUTH_MVP_USER_NAME = process.env.AUTH_MVP_USER_NAME || 'MVP Anonymous';
const AUTH_MVP_USER_EMAIL =
  process.env.AUTH_MVP_USER_EMAIL || 'mvp-anonymous@leadengine.local';
const AUTH_MVP_ROLE = (process.env.AUTH_MVP_ROLE || 'ADMIN') as UserRole;

/**
 * Gera hash da senha usando bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verifica se a senha corresponde ao hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Gera token JWT para o usuário
 */
export function generateToken(user: {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
}): string {
  const payload: JWTPayload = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Verifica e decodifica token JWT
 */
export function verifyToken(token: string): JWTPayload {
  const attemptedSecrets = [JWT_SECRET, DEMO_JWT_SECRET].filter(
    (secret): secret is string => typeof secret === 'string' && secret.length > 0
  );

  let lastError: unknown;

  for (const secret of attemptedSecrets) {
    try {
      const payload = jwt.verify(token, secret) as JWTPayload;
      if (secret !== JWT_SECRET) {
        logger.debug('[Auth] JWT verificado usando segredo alternativo');
      }
      if (secret === DEMO_JWT_SECRET) {
        payload.__verifiedWithDemoSecret = true;
      }
      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  // Em última instância, preserve o comportamento padrão para não mascarar erros
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

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
const allowJwtPayloadFallback =
  process.env.AUTH_ALLOW_JWT_FALLBACK === 'true' || (!isProductionEnv && process.env.AUTH_ALLOW_JWT_FALLBACK !== 'false');

const ensureArrayOfStrings = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
};

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

const resolveTenantIdFromRequest = (req: Request, decoded: JWTPayload): string | undefined => {
  const headerTenant = req.headers['x-tenant-id'];
  if (typeof headerTenant === 'string' && headerTenant.trim().length > 0) {
    return headerTenant.trim();
  }
  if (Array.isArray(headerTenant) && headerTenant.length > 0) {
    return headerTenant[0];
  }

  if (decoded.tenantId && decoded.tenantId.trim().length > 0) {
    return decoded.tenantId.trim();
  }

  return undefined;
};

const buildUserFromToken = (req: Request, decoded: JWTPayload): AuthenticatedUser | null => {
  if (!decoded.id) {
    return null;
  }

  const tenantId = resolveTenantIdFromRequest(req, decoded) || 'demo-tenant';
  const role = normalizeRole(decoded.role);
  const tokenPermissions = ensureArrayOfStrings(decoded.permissions);
  const basePermissions = getPermissionsByRole(role);
  const mergedPermissions = Array.from(new Set([...basePermissions, ...tokenPermissions]));

  return {
    id: decoded.id,
    tenantId,
    email: decoded.email || `${decoded.id}@example.com`,
    name: decoded.name || decoded.email || 'Authenticated User',
    role,
    isActive: true,
    permissions: mergedPermissions,
  };
};

// ============================================================================
// Authentication Service
// ============================================================================

/**
 * Autentica usuário com email e senha
 */
export async function authenticateUser(credentials: LoginRequest): Promise<LoginResponse> {
  const { email, password, tenantId } = credentials;

  logger.info('[Auth] Tentativa de login', { email, tenantId });

  // Buscar usuário no banco
  const user = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      isActive: true,
      ...(tenantId && { tenantId }),
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      },
    },
  });

  if (!user) {
    logger.warn('[Auth] Usuário não encontrado', { email, tenantId });
    throw new Error('Credenciais inválidas');
  }

  if (!user.tenant.isActive) {
    logger.warn('[Auth] Tenant inativo', { email, tenantId: user.tenantId });
    throw new Error('Conta inativa');
  }

  // Verificar senha
  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    logger.warn('[Auth] Senha inválida', { email, userId: user.id });
    throw new Error('Credenciais inválidas');
  }

  // Atualizar último login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Gerar token
  const token = generateToken({
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  logger.info('[Auth] ✅ Login realizado com sucesso', {
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  });

  return {
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    },
    expiresIn: JWT_EXPIRES_IN,
  };
}

/**
 * Busca usuário completo pelo ID
 */
export async function getUserById(userId: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true },
    include: {
      tenant: {
        select: {
          isActive: true,
        },
      },
    },
  });

  if (!user || !user.tenant.isActive) {
    return null;
  }

  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    permissions: getPermissionsByRole(user.role),
  };
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Middleware de autenticação JWT
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    if (MVP_AUTH_BYPASS_ENABLED) {
      req.user = buildMvpBypassUser();
      return next();
    }

    // Extrair token do header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Token de acesso requerido',
        },
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verificar e decodificar o token
    let decoded: JWTPayload;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Token expirado',
          },
        });
      }
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token inválido',
        },
      });
    }

    // Buscar usuário completo no banco
    const fallbackPermitted = allowJwtPayloadFallback || decoded.__verifiedWithDemoSecret === true;

    let user: AuthenticatedUser | null = null;
    if (decoded.id) {
      try {
        user = await getUserById(decoded.id);
      } catch (lookupError) {
        logger.error('[Auth] Falha ao buscar usuário no banco', {
          userId: decoded.id,
          error: lookupError,
        });

        if (!fallbackPermitted) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'USER_LOOKUP_FAILED',
              message: 'Serviço de autenticação temporariamente indisponível',
            },
          });
        }

        const fallbackUser = buildUserFromToken(req, decoded);
        if (!fallbackUser) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'Usuário não encontrado ou inativo',
            },
          });
        }

        logger.warn('[Auth] Falha ao buscar usuário, utilizando dados do token JWT', {
          userId: decoded.id,
          tenantId: fallbackUser.tenantId,
        });

        req.user = fallbackUser;
        return next();
      }
    }

    if (!user) {
      if (!fallbackPermitted) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Usuário não encontrado ou inativo',
          },
        });
      }

      const fallbackUser = buildUserFromToken(req, decoded);
      if (!fallbackUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Usuário não encontrado ou inativo',
          },
        });
      }

      logger.warn('[Auth] Usuário não encontrado no banco, utilizando dados do token JWT', {
        userId: decoded.id,
        tenantId: fallbackUser.tenantId,
      });

      req.user = fallbackUser;
      return next();
    }

    // Adicionar usuário ao request
    req.user = user;
    next();
  } catch (error) {
    logger.error('[Auth] Erro no middleware de autenticação', { error });
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
 * Middleware para verificar permissões específicas
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Usuário não autenticado',
        },
      });
    }

    if (!req.user.permissions.includes(permission) && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permissão requerida: ${permission}`,
        },
      });
    }

    next();
  };
};

/**
 * Middleware para verificar papel específico
 */
export const requireRole = (requiredRole: 'ADMIN' | 'SUPERVISOR') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Usuário não autenticado',
        },
      });
    }

    if (req.user.role !== requiredRole && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: `Papel requerido: ${requiredRole}`,
        },
      });
    }

    next();
  };
};

/**
 * Middleware para verificar se o usuário pertence ao tenant
 */
export const requireTenant = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  if (MVP_AUTH_BYPASS_ENABLED) {
    req.user = req.user ?? buildMvpBypassUser();
    return next();
  }

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Usuário não autenticado',
      },
    });
  }

  next();
};

/**
 * Middleware opcional de autenticação (não falha se não houver token)
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (MVP_AUTH_BYPASS_ENABLED) {
    req.user = buildMvpBypassUser();
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Continua sem usuário
  }

  try {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    const user = await getUserById(decoded.id);
    
    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Ignora erros de token em auth opcional
    logger.debug('[Auth] Token opcional inválido ignorado', { error });
  }

  next();
};
