import { Router, type Request, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/error-handler';
import { authenticateUser, authMiddleware, hashPassword } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';

const router: Router = Router();

/**
 * POST /api/auth/login - Autenticar usuário
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Email válido é obrigatório'),
    body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
    body('tenantId').optional().isString().withMessage('TenantId deve ser uma string'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: errors.array(),
        },
      });
    }

    const { email, password, tenantId } = req.body;

    logger.info('[Auth] POST /login', { email, tenantId });

    try {
      const result = await authenticateUser({ email, password, tenantId });
      
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro interno';
      
      logger.warn('[Auth] Falha no login', { email, tenantId, error: message });
      
      res.status(401).json({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message,
        },
      });
    }
  })
);

/**
 * POST /api/auth/register - Registrar novo usuário (apenas ADMIN)
 */
router.post(
  '/register',
  authMiddleware,
  [
    body('name').isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
    body('email').isEmail().normalizeEmail().withMessage('Email válido é obrigatório'),
    body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
    body('phone').optional().isMobilePhone('pt-BR').withMessage('Telefone inválido'),
    body('role').isIn(['ADMIN', 'SUPERVISOR', 'AGENT']).withMessage('Papel inválido'),
    body('tenantId').optional().isString().withMessage('TenantId deve ser uma string'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    // Verificar se o usuário tem permissão para criar usuários
    if (!req.user?.permissions.includes('users:write') && req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Permissão insuficiente para criar usuários',
        },
      });
    }

    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: errors.array(),
        },
      });
    }

    const { name, email, password, phone, role, tenantId } = req.body;
    const targetTenantId = tenantId || req.user!.tenantId;

    logger.info('[Auth] POST /register', { 
      email, 
      role, 
      tenantId: targetTenantId,
      createdBy: req.user!.id 
    });

    try {
      // Verificar se o email já existe no tenant
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          tenantId: targetTenantId,
        },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Email já está em uso neste tenant',
          },
        });
      }

      // Hash da senha
      const passwordHash = await hashPassword(password);

      // Criar usuário
      const newUser = await prisma.user.create({
        data: {
          tenantId: targetTenantId,
          name,
          email: email.toLowerCase(),
          phone,
          role,
          passwordHash,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      logger.info('[Auth] ✅ Usuário criado com sucesso', {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        tenantId: targetTenantId,
        createdBy: req.user!.id,
      });

      res.status(201).json({
        success: true,
        data: newUser,
        message: 'Usuário criado com sucesso',
      });
    } catch (error) {
      logger.error('[Auth] Erro ao criar usuário', { error, email, tenantId: targetTenantId });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'USER_CREATION_FAILED',
          message: 'Falha ao criar usuário',
        },
      });
    }
  })
);

/**
 * GET /api/auth/me - Obter dados do usuário atual
 */
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;

    logger.info('[Auth] GET /me', { userId: user.id });

    // Buscar dados completos do usuário
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        settings: true,
        lastLoginAt: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            settings: true,
          },
        },
      },
    });

    if (!userData) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuário não encontrado',
        },
      });
    }

    res.json({
      success: true,
      data: {
        ...userData,
        permissions: user.permissions,
      },
    });
  })
);

/**
 * PUT /api/auth/profile - Atualizar perfil do usuário
 */
router.put(
  '/profile',
  authMiddleware,
  [
    body('name').optional().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
    body('phone').optional().isMobilePhone('pt-BR').withMessage('Telefone inválido'),
    body('avatar').optional().isURL().withMessage('Avatar deve ser uma URL válida'),
    body('settings').optional().isObject().withMessage('Settings deve ser um objeto'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: errors.array(),
        },
      });
    }

    const { name, phone, avatar, settings } = req.body;
    const userId = req.user!.id;

    logger.info('[Auth] PUT /profile', { userId });

    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name && { name }),
          ...(phone && { phone }),
          ...(avatar && { avatar }),
          ...(settings && { settings }),
          updatedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          role: true,
          settings: true,
          updatedAt: true,
        },
      });

      logger.info('[Auth] ✅ Perfil atualizado', { userId });

      res.json({
        success: true,
        data: updatedUser,
        message: 'Perfil atualizado com sucesso',
      });
    } catch (error) {
      logger.error('[Auth] Erro ao atualizar perfil', { error, userId });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'PROFILE_UPDATE_FAILED',
          message: 'Falha ao atualizar perfil',
        },
      });
    }
  })
);

/**
 * PUT /api/auth/password - Alterar senha
 */
router.put(
  '/password',
  authMiddleware,
  [
    body('currentPassword').isLength({ min: 1 }).withMessage('Senha atual é obrigatória'),
    body('newPassword').isLength({ min: 6 }).withMessage('Nova senha deve ter pelo menos 6 caracteres'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: errors.array(),
        },
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    logger.info('[Auth] PUT /password', { userId });

    try {
      // Buscar usuário com senha atual
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Usuário não encontrado',
          },
        });
      }

      // Verificar senha atual
      const { verifyPassword } = await import('../middleware/auth');
      const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CURRENT_PASSWORD',
            message: 'Senha atual incorreta',
          },
        });
      }

      // Hash da nova senha
      const newPasswordHash = await hashPassword(newPassword);

      // Atualizar senha
      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        },
      });

      logger.info('[Auth] ✅ Senha alterada', { userId });

      res.json({
        success: true,
        message: 'Senha alterada com sucesso',
      });
    } catch (error) {
      logger.error('[Auth] Erro ao alterar senha', { error, userId });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_FAILED',
          message: 'Falha ao alterar senha',
        },
      });
    }
  })
);

/**
 * POST /api/auth/logout - Logout (placeholder para invalidação de token)
 */
router.post(
  '/logout',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    logger.info('[Auth] POST /logout', { userId });

    // Em uma implementação completa, aqui seria adicionado o token a uma blacklist
    // Por enquanto, apenas retornamos sucesso
    
    res.json({
      success: true,
      message: 'Logout realizado com sucesso',
    });
  })
);

export { router as authRouter };
