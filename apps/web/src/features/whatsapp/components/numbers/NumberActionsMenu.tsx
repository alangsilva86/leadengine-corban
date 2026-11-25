import { Link } from 'react-router-dom';
import { isDiagnosticsEnabled } from '@/lib/features.js';
import { Activity, Info, MoreHorizontal, PlugZap, RefreshCw, Trash2, Unplug } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';

import type { WhatsAppNumber } from '../../hooks/useWhatsAppNumbers';

export type NumberAction = 'details' | 'connect' | 'disconnect' | 'delete';

export const diagnosticsHref = (number: WhatsAppNumber) =>
  `/settings/diagnostics?instance=${encodeURIComponent(number.id)}`;

interface NumberActionsMenuProps {
  number: WhatsAppNumber;
  onAction: (action: NumberAction, number: WhatsAppNumber) => void;
  disabled?: boolean;
}

/** Menu "⋯" de um número. Só mostra ações que a API suporta (não há endpoint para renomear). */
const NumberActionsMenu = ({ number, onAction, disabled = false }: NumberActionsMenuProps) => {
  const { status, isSessionOnly } = number;
  const canReconnect = !status.isConnected && status.key !== 'connecting' && !isSessionOnly;
  const canDisconnect = status.isConnected || status.key === 'connecting' || isSessionOnly;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Mais ações para ${number.name}`}
              disabled={disabled}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">Mais ações</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => onAction('details', number)}>
          <Info aria-hidden="true" />
          Ver detalhes
        </DropdownMenuItem>
        {canReconnect ? (
          <DropdownMenuItem onSelect={() => onAction('connect', number)}>
            {status.key === 'pairing' || status.key === 'qr_expired' ? (
              <PlugZap aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            {status.key === 'pairing' || status.key === 'qr_expired' ? 'Conectar' : 'Reconectar'}
          </DropdownMenuItem>
        ) : null}
        {isDiagnosticsEnabled() ? (
          <DropdownMenuItem asChild>
            <Link to={diagnosticsHref(number)}>
              <Activity aria-hidden="true" />
              Ver diagnóstico
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canDisconnect || !isSessionOnly ? <DropdownMenuSeparator /> : null}
        {canDisconnect ? (
          <DropdownMenuItem onSelect={() => onAction('disconnect', number)}>
            <Unplug aria-hidden="true" />
            Desconectar
          </DropdownMenuItem>
        ) : null}
        {!isSessionOnly ? (
          <DropdownMenuItem variant="destructive" onSelect={() => onAction('delete', number)}>
            <Trash2 aria-hidden="true" />
            Excluir número
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NumberActionsMenu;
