import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Loader2, MoreVertical, QrCode, Trash2 } from 'lucide-react';

const InstanceActionsMenu = ({
  instance,
  deletingInstanceId,
  isBusy,
  isAuthenticated,
  onViewQr,
  onRequestDelete,
  onRenameInstance,
  onViewLogs,
}) => {
  const isDeleting = deletingInstanceId === instance?.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ações da instância"
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => onRenameInstance?.(instance)}
          disabled={isDeleting}
        >
          Renomear instância
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onViewQr?.(instance)} disabled={isBusy || !isAuthenticated}>
          <QrCode className="mr-2 h-4 w-4" />
          Ver QR em tela cheia
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onViewLogs?.(instance)} disabled={isBusy}>
          Ver logs da sessão
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(event) => {
            event.preventDefault();
            onRequestDelete?.(instance);
          }}
          disabled={isDeleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Remover instância
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default InstanceActionsMenu;
