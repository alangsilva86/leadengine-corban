import type { RequestHandler } from 'express';
import { ForbiddenError } from '@ticketz/core';

import type { UserRole } from './auth';

export const requireRoles = (...roles: UserRole[]): RequestHandler => {
  const allowed = roles.length > 0 ? new Set<UserRole>(roles) : null;

  return (req, _res, next) => {
    if (!req.user) {
      return next(new ForbiddenError('Usuário não autenticado.'));
    }

    if (allowed && !allowed.has(req.user.role)) {
      return next(new ForbiddenError('Operação permitida apenas para administradores.'));
    }

    next();
  };
};
