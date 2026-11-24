import type { Socket } from 'socket.io';
import { logger } from '../config/logger';
import { prisma } from '../lib/prisma';
import { findActiveSession, type AuthenticatedUser, type SessionClaims } from '../middleware/auth';

export const registerSocketConnectionHandlers = (socket: Socket): void => {
  const session = socket.data.session as { user: AuthenticatedUser; claims: SessionClaims } | undefined;
  if (!session) {
    socket.disconnect(true);
    return;
  }
  const { user, claims } = session;
  const { tenantId, id: userId } = user;
  const tenantRoom = `tenant:${tenantId}`;
  const userRoom = `user:${userId}`;
  void socket.join([tenantRoom, userRoom]);

  const validateSession = async () => {
    try {
      return claims.exp * 1000 > Date.now() && Boolean(await findActiveSession(claims));
    } catch {
      return false;
    }
  };

  socket.use((_packet, next) => {
    void validateSession().then((valid) => {
      if (valid) return next();
      socket.disconnect(true);
      next(new Error('UNAUTHORIZED'));
    });
  });

  const revalidate = setInterval(() => {
    void validateSession().then((valid) => { if (!valid) socket.disconnect(true); });
  }, 30_000);
  revalidate.unref();
  socket.once('disconnect', () => clearInterval(revalidate));

  // Compatibility with clients from before room membership was server-derived.
  socket.on('join-tenant', (requested, ack) => {
    const id = typeof requested === 'string' ? requested : requested?.tenantId;
    if (typeof ack === 'function') ack(id === tenantId ? { ok: true } : { ok: false, error: 'FORBIDDEN' });
  });

  const canReadTicket = (id: string) => prisma.ticket.findFirst({
    where: { id, tenantId }, select: { id: true },
  });
  const canReadCampaign = (id: string) => prisma.campaign.findFirst({
    where: { id, tenantId }, select: { id: true },
  });

  const registerResource = (
    resource: 'ticket' | 'campaign',
    canRead: (id: string) => PromiseLike<{ id: string } | null>,
  ) => {
    socket.on(`join-${resource}`, async (id: unknown) => {
      if (typeof id !== 'string' || !id) return;
      try {
        if (await canRead(id) && socket.connected) await socket.join(`${resource}:${id}`);
      } catch (error) {
        logger.warn('Falha ao autorizar uma inscrição de tempo real', { resource, error });
      }
    });
    socket.on(`leave-${resource}`, (id: unknown) => {
      if (typeof id === 'string' && id) void socket.leave(`${resource}:${id}`);
    });
  };
  registerResource('ticket', canReadTicket);
  registerResource('campaign', canReadCampaign);

  socket.on('ticket:typing', (payload) => {
    const ticketId = payload?.ticketId;
    if (typeof ticketId !== 'string' || !socket.rooms.has(`ticket:${ticketId}`)) return;
    socket.to(`ticket:${ticketId}`).emit('ticket:typing', { ticketId, userId, timestamp: Date.now() });
  });
};
