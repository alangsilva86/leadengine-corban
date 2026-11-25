import type { Socket } from 'socket.io';
import { logger } from '../config/logger';
import { prisma } from '../lib/prisma';
import { findActiveSession, type AuthenticatedUser, type SessionClaims } from '../middleware/auth';

/** Intervalo mínimo entre dois "começou a digitar" repassados para o mesmo ticket (o web reenvia a cada ~2,5 s). */
export const TYPING_RELAY_MIN_INTERVAL_MS = 1_000;

type SessionData = { user: AuthenticatedUser; claims: SessionClaims } | undefined;

export type TicketViewer = { userId: string; userName: string | null };

/**
 * Quem está com o ticket aberto (sala `ticket:<id>`), um registro por usuário. A lista vai inteira a cada mudança
 * — o cliente não precisa reconciliar entradas/saídas.
 */
const listTicketViewers = async (socket: Socket, room: string): Promise<TicketViewer[]> => {
  const sockets = await socket.nsp.in(room).fetchSockets();
  const viewers = new Map<string, TicketViewer>();
  for (const member of sockets) {
    const memberUser = (member.data?.session as SessionData)?.user;
    if (memberUser?.id && !viewers.has(memberUser.id)) {
      viewers.set(memberUser.id, { userId: memberUser.id, userName: memberUser.name ?? null });
    }
  }
  return [...viewers.values()];
};

export const registerSocketConnectionHandlers = (socket: Socket): void => {
  const session = socket.data.session as { user: AuthenticatedUser; claims: SessionClaims } | undefined;
  if (!session) {
    socket.disconnect(true);
    return;
  }
  const { user, claims } = session;
  const { tenantId, id: userId } = user;
  const userName = typeof user.name === 'string' && user.name.trim() ? user.name.trim() : null;
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

  // ---- Presença no ticket (prevenção de colisão entre atendentes) ------------------------------------------
  // Só agentes autenticados do tenant recebem estes eventos (salas do servidor); nada vai para o cliente final
  // nem para o broker do WhatsApp.
  const typingTickets = new Map<string, number>();

  const emitTyping = (ticketId: string, state: 'start' | 'stop', mode: 'reply' | 'note') => {
    // Sala do ticket (quem está com a conversa aberta) + sala do tenant (indicador na lista de conversas).
    // `socket.to` exclui o próprio socket; outras abas do mesmo usuário são filtradas no cliente.
    socket.to([`ticket:${ticketId}`, tenantRoom]).emit('ticket:typing', {
      ticketId,
      userId,
      userName,
      state,
      mode,
      timestamp: Date.now(),
    });
  };

  const stopTyping = (ticketId: string) => {
    if (!typingTickets.delete(ticketId)) return;
    emitTyping(ticketId, 'stop', 'reply');
  };

  const broadcastViewers = async (ticketId: string) => {
    try {
      const viewers = await listTicketViewers(socket, `ticket:${ticketId}`);
      socket.nsp.to(`ticket:${ticketId}`).emit('ticket:viewers', { ticketId, viewers, timestamp: Date.now() });
    } catch (error) {
      logger.warn('Falha ao listar quem está vendo o ticket', { ticketId, error });
    }
  };

  const registerResource = (
    resource: 'ticket' | 'campaign',
    canRead: (id: string) => PromiseLike<{ id: string } | null>,
  ) => {
    socket.on(`join-${resource}`, async (id: unknown) => {
      if (typeof id !== 'string' || !id) return;
      try {
        if (await canRead(id) && socket.connected) {
          await socket.join(`${resource}:${id}`);
          if (resource === 'ticket') await broadcastViewers(id);
        }
      } catch (error) {
        logger.warn('Falha ao autorizar uma inscrição de tempo real', { resource, error });
      }
    });
    socket.on(`leave-${resource}`, async (id: unknown) => {
      if (typeof id !== 'string' || !id) return;
      if (resource === 'ticket') stopTyping(id);
      await socket.leave(`${resource}:${id}`);
      if (resource === 'ticket') await broadcastViewers(id);
    });
  };
  registerResource('ticket', canReadTicket);
  registerResource('campaign', canReadCampaign);

  socket.on('ticket:typing', (payload) => {
    const ticketId = payload?.ticketId;
    if (typeof ticketId !== 'string' || !socket.rooms.has(`ticket:${ticketId}`)) return;
    const state = payload?.state === 'stop' ? 'stop' : 'start';
    const mode = payload?.mode === 'note' ? 'note' : 'reply';

    if (state === 'stop') {
      stopTyping(ticketId);
      return;
    }

    const now = Date.now();
    const lastRelayAt = typingTickets.get(ticketId);
    if (lastRelayAt !== undefined && now - lastRelayAt < TYPING_RELAY_MIN_INTERVAL_MS) return;
    typingTickets.set(ticketId, now);
    emitTyping(ticketId, 'start', mode);
  });

  // `disconnecting`: as salas ainda existem — avisa que parou de digitar e atualiza quem está vendo.
  socket.on('disconnecting', () => {
    const ticketIds = [...socket.rooms]
      .filter((room) => room.startsWith('ticket:'))
      .map((room) => room.slice('ticket:'.length));
    [...typingTickets.keys()].forEach(stopTyping);
    ticketIds.forEach((ticketId) => {
      // Após o disconnect o socket já saiu da sala; recalcula com quem ficou.
      setImmediate(() => void broadcastViewers(ticketId));
    });
  });
};
