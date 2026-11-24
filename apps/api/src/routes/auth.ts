import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AuthSession, Tenant, User } from '@prisma/client';
import { getJwtSecret } from '../config/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import {
  authMiddleware,
  findActiveSession,
  getPermissionsByRole,
  requireTenant,
  verifySessionToken,
  type AuthenticatedUser,
} from '../middleware/auth';

const router = Router();
const ACCESS_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * 60 * 60;
const REFRESH_COOKIE = 'corban_refresh';
const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
};

const readRefreshCookie = (header: string | undefined) =>
  header?.split(';').map(value => value.trim())
    .find(value => value.startsWith(`${REFRESH_COOKIE}=`))
    ?.slice(REFRESH_COOKIE.length + 1);

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const normalizeJson = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const normalizeSlug = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

const buildUserProfile = (user: User, tenant: Tenant): AuthenticatedUser & {
  settings: Record<string, unknown>;
} => ({
  id: user.id,
  tenantId: tenant.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  permissions: getPermissionsByRole(user.role),
  tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, settings: normalizeJson(tenant.settings) },
  settings: normalizeJson(user.settings),
});

const respondWithSession = (
  res: Response, user: User, tenant: Tenant, session: AuthSession, useCookie = false,
) => {
  const claims = { sub: user.id, tenantId: tenant.id, sid: session.id };
  const refreshExpiry = Math.floor(session.expiresAt.getTime() / 1000);
  const accessExpiry = Math.min(refreshExpiry, Math.floor(Date.now() / 1000) + ACCESS_SECONDS);
  const secret = getJwtSecret();
  const refreshToken = jwt.sign({ ...claims, type: 'refresh', exp: refreshExpiry, jti: session.refreshNonce }, secret);

  if (useCookie) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...refreshCookieOptions,
      ...(session.expiresAt.getTime() - session.createdAt.getTime() > DAY_SECONDS * 1000
        ? { expires: session.expiresAt } : {}),
    });
  }

  return res.json({
    success: true,
    data: {
      token: {
        accessToken: jwt.sign({ ...claims, type: 'access', exp: accessExpiry }, secret),
        ...(useCookie ? {} : { refreshToken }),
        expiresIn: Math.max(0, accessExpiry - Math.floor(Date.now() / 1000)),
      },
      user: buildUserProfile(user, tenant),
    },
  });
};

const invalidCredentials = (res: Response) => res.status(401).json({
  success: false,
  error: { code: 'INVALID_CREDENTIALS', message: 'Credenciais ou sessão inválidas.' },
});

router.post('/login', async (req, res) => {
  const { email, password, tenantSlug, remember, sessionCookie } = req.body ?? {};
  if (
    typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password ||
    typeof tenantSlug !== 'string' || !tenantSlug.trim()
  ) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PAYLOAD', message: 'Credenciais e organização são obrigatórias.' },
    });
  }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: normalizeSlug(tenantSlug) } });
    if (!tenant?.isActive) return invalidCredentials(res);

    const user = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: email.trim().toLowerCase() },
    });
    if (!user?.isActive || !user.passwordHash || !await bcrypt.compare(password, user.passwordHash)) {
      return invalidCredentials(res);
    }

    const lifetime = remember === true || remember === 'true' ? 7 * DAY_SECONDS : DAY_SECONDS;
    const now = new Date();
    const session = await prisma.$transaction(async (tx) => {
      await tx.authSession.deleteMany({ where: { userId: user.id, expiresAt: { lte: now } } });
      return tx.authSession.create({
        data: {
          id: randomUUID(), userId: user.id, refreshNonce: randomUUID(),
          expiresAt: new Date(now.getTime() + lifetime * 1000),
        },
      });
    });
    return respondWithSession(res, user, tenant, session, sessionCookie === true);
  } catch (error) {
    logger.error('[Auth] Falha no login', { error });
    return res.status(500).json({
      success: false,
      error: { code: 'AUTH_LOGIN_FAILED', message: 'Não foi possível autenticar no momento.' },
    });
  }
});

router.post('/register', (_req, res) => res.status(403).json({
  success: false,
  error: { code: 'REGISTRATION_DISABLED', message: 'Usuários são cadastrados pelo administrador da organização.' },
}));

router.post('/token/refresh', async (req, res) => {
  const bodyToken = req.body?.refreshToken;
  const useCookie = typeof bodyToken !== 'string';
  const refreshToken = useCookie ? readRefreshCookie(req.headers.cookie) : bodyToken;
  if (typeof refreshToken !== 'string' || !refreshToken) return invalidCredentials(res);

  try {
    const claims = verifySessionToken(refreshToken, 'refresh');
    const session = await findActiveSession(claims);
    if (!session || session.refreshNonce !== claims.jti) return invalidCredentials(res);

    const refreshNonce = randomUUID();
    const updated = await prisma.authSession.updateMany({
      where: { id: session.id, refreshNonce: session.refreshNonce, expiresAt: { gt: new Date() } },
      data: { refreshNonce },
    });
    if (updated.count === 0) return invalidCredentials(res);
    return respondWithSession(res, session.user, session.user.tenant, { ...session, refreshNonce }, useCookie);
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError)) {
      logger.error('[Auth] Falha ao renovar sessão', { error });
      return res.status(503).json({ success: false, error: { code: 'AUTH_UNAVAILABLE', message: 'Sessão indisponível.' } });
    }
    return invalidCredentials(res);
  }
});

router.post('/logout', async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  const cookie = readRefreshCookie(req.headers.cookie);
  const readClaims = (value: string | undefined, type: 'access' | 'refresh') => {
    try {
      return value ? verifySessionToken(value, type) : null;
    } catch {
      return null;
    }
  };

  try {
    const claims = readClaims(token, 'access') ?? readClaims(cookie, 'refresh');
    if (claims && (claims.type === 'access' || typeof claims.jti === 'string')) {
      await prisma.authSession.deleteMany({ where: {
        id: claims.sid, userId: claims.sub,
        ...(claims.type === 'refresh' && typeof claims.jti === 'string' ? { refreshNonce: claims.jti } : {}),
      } });
    }
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authMiddleware, requireTenant, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { tenant: true } });
    if (!user?.tenant) return invalidCredentials(res);
    return res.json({ success: true, data: buildUserProfile(user, user.tenant) });
  } catch (error) {
    return next(error);
  }
});

export const authRouter = router;
