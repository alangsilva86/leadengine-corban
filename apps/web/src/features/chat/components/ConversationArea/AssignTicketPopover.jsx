import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, User, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import { useSearchUsersQuery } from '../../api/useSearchUsersQuery.js';
import { getPrimaryCommandAnchorId } from '../../actions/commandAnchors.js';
import { getFirstName, resolveTicketAssignee } from './utils/presentation.js';
import { getPersonInitials } from '@/lib/initials';

/**
 * Lista de agentes — montada só com o popover aberto (a busca não roda à toa
 * e o botão do responsável funciona mesmo fora de um QueryClientProvider).
 */
const AssigneePicker = ({ selectedUserId, onSelectUser, onUsersLoaded }) => {
  const [search, setSearch] = useState('');
  const { data: users = [], isLoading, error, refetch } = useSearchUsersQuery({ search, enabled: true });

  useEffect(() => {
    onUsersLoaded?.(Array.isArray(users) ? users : []);
  }, [onUsersLoaded, users]);

  const queryErrorMessage = error instanceof Error ? error.message : null;

  let content;
  if (isLoading) {
    content = (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Buscando agentes…
      </div>
    );
  } else if (queryErrorMessage) {
    content = (
      <div className="space-y-1 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground" role="alert">
        <p>Não foi possível carregar a equipe.</p>
        <button type="button" className="font-medium underline" onClick={() => refetch?.()}>
          Tentar novamente
        </button>
      </div>
    );
  } else if (!Array.isArray(users) || users.length === 0) {
    content = (
      <div className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        Nenhum agente encontrado.
      </div>
    );
  } else {
    content = (
      <ScrollArea className="max-h-56 pr-3">
        <div className="flex flex-col gap-1">
          {users.map((user) => {
            if (!user || !user.id) return null;
            const normalizedUserId = String(user.id);
            const isSelected = selectedUserId === normalizedUserId;
            return (
              <button
                key={normalizedUserId}
                type="button"
                onClick={() => onSelectUser(normalizedUserId, user)}
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected ? 'border-primary bg-primary-soft text-foreground' : 'border-transparent text-foreground hover:bg-surface-hover',
                )}
              >
                <span className="truncate">{user.name ?? user.email ?? 'Agente'}</span>
                {isSelected ? <Check className="size-4 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="assign-user-search">
          Buscar agente
        </label>
        <Input id="assign-user-search" placeholder="Digite o nome" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      {content}
    </>
  );
};

/**
 * Botão do responsável no cabeçalho: avatar de quem atende ou "Atribuir".
 * Abre um seletor com "Atribuir a mim" e a busca de agentes.
 */
const AssignTicketPopover = ({ entry, context, focusMap, buttonClassName, currentUser = null }) => {
  const { definition, canExecute, state } = entry;
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignError, setAssignError] = useState(null);
  const [pendingAssignee, setPendingAssignee] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUserId = currentUser?.id != null ? String(currentUser.id) : null;

  useEffect(() => {
    if (!triggerRef.current || !focusMap) return undefined;
    const map = focusMap.current;
    map.set(definition.id, triggerRef.current);
    return () => {
      map.delete(definition.id);
    };
  }, [definition.id, focusMap]);

  useEffect(() => {
    setPendingAssignee(null);
    setSelectedUserId(null);
    setSelectedUser(null);
    setOpen(false);
    setAssignError(null);
  }, [context.ticket?.id]);

  const ticketAssignee = useMemo(
    () => resolveTicketAssignee(context?.ticket, currentUser),
    [context?.ticket, currentUser],
  );

  const displayAssignee = pendingAssignee ?? ticketAssignee;
  const isMine = Boolean(displayAssignee && currentUserId && displayAssignee.id === currentUserId);
  const ownerLabel = displayAssignee ? (isMine ? 'Você' : getFirstName(displayAssignee.name) ?? 'Responsável') : null;

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    setAssignError(null);
    if (nextOpen) {
      setSelectedUserId(displayAssignee?.id ?? null);
    } else {
      setSelectedUserId(null);
      setSelectedUser(null);
    }
  };

  const assignTo = async (userId, user) => {
    if (!userId) {
      setAssignError('Selecione um responsável para continuar.');
      return;
    }
    if (!definition.run) {
      setAssignError('Ação indisponível no momento.');
      return;
    }
    setIsSubmitting(true);
    const contextWithTarget = { ...context, returnFocus: triggerRef.current ?? null, targetUserId: userId };
    try {
      await Promise.resolve(definition.run(contextWithTarget));
      definition.analytics?.(contextWithTarget);
      setPendingAssignee({
        id: userId,
        name: user?.name ?? (userId === currentUserId ? currentUser?.name ?? 'Você' : userId),
      });
      setOpen(false);
      setAssignError(null);
    } catch (assignFailure) {
      setAssignError(assignFailure instanceof Error ? assignFailure.message : 'Não foi possível atribuir a conversa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const disabled = !canExecute || state?.disabled;
  const loading = Boolean(state?.loading || isSubmitting);
  const triggerAriaLabel = displayAssignee ? `Responsável: ${ownerLabel}. Alterar responsável` : 'Atribuir conversa';

  return (
    <Tooltip>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
              id={getPrimaryCommandAnchorId(definition.id)}
              type="button"
              variant="ghost"
              size={displayAssignee ? 'sm' : 'icon-sm'}
              className={cn(displayAssignee && 'gap-1.5 px-1.5', buttonClassName)}
              disabled={disabled || loading}
              aria-label={triggerAriaLabel}
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              {loading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : displayAssignee ? (
                <span
                  aria-hidden
                  className="inline-flex size-6 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary-soft-foreground"
                >
                  {getPersonInitials(displayAssignee.name ?? (isMine ? currentUser?.name : null), '') || (
                    <User className="size-3.5" />
                  )}
                </span>
              ) : (
                <UserPlus aria-hidden />
              )}
              {displayAssignee ? (
                <span className="hidden max-w-24 truncate text-sm 2xl:inline">{ownerLabel}</span>
              ) : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {displayAssignee ? `Responsável: ${ownerLabel}` : 'Atribuir a alguém da equipe'}
        </TooltipContent>
        <PopoverContent align="end" className="w-80 space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Responsável</p>
            <p className="text-sm text-muted-foreground">
              {displayAssignee ? `Atual: ${ownerLabel}` : 'Ninguém está com esta conversa.'}
            </p>
          </div>
          {currentUserId && !isMine ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => assignTo(currentUserId, { name: currentUser?.name })}
              disabled={isSubmitting}
            >
              Atribuir a mim
            </Button>
          ) : null}
          {open ? (
            <AssigneePicker
              selectedUserId={selectedUserId}
              onSelectUser={(userId, user) => {
                setSelectedUserId(userId);
                setSelectedUser(user);
                setAssignError(null);
              }}
            />
          ) : null}
          {assignError ? (
            <p className="text-sm text-danger-soft-foreground" role="alert">
              {assignError}
            </p>
          ) : null}
          <Button
            type="button"
            className="w-full"
            onClick={() => assignTo(selectedUserId, selectedUser)}
            disabled={!selectedUserId || isSubmitting}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Atribuindo…
              </span>
            ) : (
              'Confirmar'
            )}
          </Button>
        </PopoverContent>
      </Popover>
    </Tooltip>
  );
};

export default AssignTicketPopover;
