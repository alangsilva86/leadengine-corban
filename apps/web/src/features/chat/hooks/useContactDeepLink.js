import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiGet } from '@/lib/api.js';

const OPEN_STATUSES = new Set(['OPEN', 'PENDING', 'ASSIGNED']);

const toTime = (value) => {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? 0 : time;
};

const pickBestTicket = (tickets, contactId) => {
  const own = tickets.filter((ticket) => ticket?.contactId === contactId || ticket?.contact?.id === contactId);
  if (own.length === 0) return null;
  const byRecency = [...own].sort(
    (a, b) => toTime(b.lastMessageAt ?? b.updatedAt) - toTime(a.lastMessageAt ?? a.updatedAt),
  );
  return byRecency.find((ticket) => OPEN_STATUSES.has(String(ticket.status ?? '').toUpperCase())) ?? byRecency[0];
};

/**
 * `/inbox?contactId=<id>` (links "Abrir conversa" do CRM/Contatos):
 * abre a conversa aberta mais recente do contato; se não houver, devolve o contato
 * para o Inbox mostrar um estado vazio com "Nova conversa" (nada é enviado sozinho).
 * O parâmetro sai da URL depois de tratado.
 *
 * @param {{ enabled?: boolean, onSelectTicket?: (ticketId: string, ticket: object) => void }} [options]
 */
export const useContactDeepLink = ({ enabled = true, onSelectTicket } = {}) => {
  // Lido pelo roteador (não por window.location) para que links novos com o Inbox já aberto também funcionem.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlContactId = searchParams.get('contactId')?.trim() || null;
  const [state, setState] = useState(() =>
    urlContactId ? { status: 'loading', contactId: urlContactId, contact: null } : { status: 'idle', contactId: null, contact: null },
  );
  const handledRef = useRef(urlContactId);
  const selectRef = useRef(onSelectTicket);
  selectRef.current = onSelectTicket;
  const { status, contactId } = state;

  useEffect(() => {
    if (urlContactId === handledRef.current) return;
    handledRef.current = urlContactId;
    if (urlContactId) {
      setState({ status: 'loading', contactId: urlContactId, contact: null });
    }
  }, [urlContactId]);

  /** Remove `contactId` da URL via roteador, sem criar entrada no histórico. */
  const clearContactIdFromUrl = useCallback(() => {
    setSearchParams(
      (previous) => {
        if (!previous.has('contactId')) return previous;
        const next = new URLSearchParams(previous);
        next.delete('contactId');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  useEffect(() => {
    if (!enabled || status !== 'loading' || !contactId) return undefined;
    let cancelled = false;

    const run = async () => {
      try {
        const params = new URLSearchParams({
          search: contactId,
          limit: '20',
          sortBy: 'lastMessageAt',
          sortOrder: 'desc',
          include: 'contact,lead,notes',
        });
        const payload = await apiGet(`/api/tickets?${params.toString()}`);
        const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
        const ticket = pickBestTicket(items, contactId);
        if (cancelled) return;
        if (ticket) {
          selectRef.current?.(ticket.id, ticket);
          setState({ status: 'found', contactId, contact: ticket.contact ?? null });
          return;
        }
        let contact = null;
        try {
          const contactPayload = await apiGet(`/api/contacts/${encodeURIComponent(contactId)}`);
          contact = contactPayload?.data ?? null;
        } catch {
          contact = null;
        }
        if (!cancelled) {
          setState({ status: 'not-found', contactId, contact });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', contactId, contact: null, error });
        }
      } finally {
        if (!cancelled) clearContactIdFromUrl();
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [clearContactIdFromUrl, contactId, enabled, status]);

  const dismiss = useCallback(() => {
    setState({ status: 'idle', contactId: null, contact: null });
    clearContactIdFromUrl();
  }, [clearContactIdFromUrl]);

  return { ...state, dismiss };
};

export default useContactDeepLink;
