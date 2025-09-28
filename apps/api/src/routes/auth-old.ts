import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/error-handler';

const router: Router = Router();

// POST /api/auth/login - Login
router.post(
  '/login',
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as { email: string; password: string };

    // TODO: Implementar validação real do usuário
    // Por enquanto, mock para demonstração
    const mockUser = {
      id: 'user-123',
      tenantId: 'tenant-123',
      email: email,
      role: 'agent',
      permissions: ['tickets:read', 'tickets:write', 'contacts:read'],
    };

    // Verificar senha (mock)
    const isValidPassword = password === 'password123';
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Gerar token JWT
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      {
        id: mockUser.id,
        tenantId: mockUser.tenantId,
        email: mockUser.email,
        role: mockUser.role,
        permissions: mockUser.permissions,
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          permissions: mockUser.permissions,
        },
        expiresIn: '24h',
      },
    });
  })
);

// POST /api/auth/register - Registro (se habilitado)
router.post(
  '/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('name').isLength({ min: 2 }),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, name } = req.body as { email: string; name: string };

    // TODO: Implementar registro real
    res.status(201).json({
      success: true,
      data: {
        message: 'User registered successfully',
        user: {
          id: 'new-user-id',
          email,
          name,
        },
      },
    });
  })
);

// POST /api/auth/refresh - Renovar token
router.post(
  '/refresh',
  body('token').isString(),
  asyncHandler(async (_req: Request, res: Response) => {
    // TODO: Implementar renovação de token
    res.json({
      success: true,
      data: {
        token: 'new-token',
        expiresIn: '24h',
      },
    });
  })
);

// POST /api/auth/logout - Logout
router.post(
  '/logout',
  asyncHandler(async (_req: Request, res: Response) => {
    // TODO: Implementar invalidação de token (blacklist)
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

export { router as authRouter };
