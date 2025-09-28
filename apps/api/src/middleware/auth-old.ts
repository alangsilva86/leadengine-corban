import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '@ticketz/core';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  role: string;
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

export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    
    // Verificar e decodificar o token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Validar estrutura do token
    if (!decoded.id || !decoded.tenantId || !decoded.email) {
      throw new UnauthorizedError('Invalid token structure');
    }

    // Adicionar usuário ao request
    req.user = {
      id: decoded.id,
      tenantId: decoded.tenantId,
      email: decoded.email,
      role: decoded.role || 'user',
      permissions: decoded.permissions || [],
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
};

// Middleware para verificar permissões específicas
export const requirePermission = (permission: string) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('User not authenticated'));
    }

    if (!req.user.permissions.includes(permission) && req.user.role !== 'admin') {
      return next(new UnauthorizedError(`Permission required: ${permission}`));
    }

    next();
  };
};

// Middleware para verificar role específica
export const requireRole = (role: string) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('User not authenticated'));
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      return next(new UnauthorizedError(`Role required: ${role}`));
    }

    next();
  };
};

// Middleware para verificar se o usuário pertence ao tenant
export const requireTenant = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new UnauthorizedError('User not authenticated'));
  }

  // Verificar se o tenantId do parâmetro corresponde ao do usuário
  const tenantId =
    (req.params?.tenantId as string | undefined) ||
    (req.body?.tenantId as string | undefined) ||
    (typeof req.query?.tenantId === 'string' ? req.query.tenantId : undefined);
  
  if (tenantId && tenantId !== req.user.tenantId && req.user.role !== 'super_admin') {
    return next(new UnauthorizedError('Access denied to this tenant'));
  }

  next();
};
