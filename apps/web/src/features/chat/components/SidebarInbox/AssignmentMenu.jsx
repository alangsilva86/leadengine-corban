import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Button } from '@/components/ui/button.jsx';
import { EllipsisVertical, BellOff, UserPlus, UserRoundPlus, StickyNote, Sparkles } from 'lucide-react';

export const AssignmentMenu = ({
  onAssign,
  onTransfer,
  onMute,
  onFollowUp,
  onMacro,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[color:var(--color-inbox-foreground-muted)] hover:text-[color:var(--color-inbox-foreground)]"
        >
          <EllipsisVertical className="h-4 w-4" />
          <span className="sr-only">Ações rápidas</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[200px] rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-lg)]"
      >
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAssign} className="gap-2 text-[color:var(--color-inbox-foreground)]">
          <UserPlus className="h-4 w-4" /> Atribuir a mim
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onTransfer} className="gap-2 text-[color:var(--color-inbox-foreground)]">
          <UserRoundPlus className="h-4 w-4" /> Transferir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMute} className="gap-2 text-[color:var(--color-inbox-foreground)]">
          <BellOff className="h-4 w-4" /> Silenciar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onFollowUp} className="gap-2 text-[color:var(--color-inbox-foreground)]">
          <StickyNote className="h-4 w-4" /> Marcar follow-up
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onMacro} className="gap-2 text-[color:var(--color-inbox-foreground)]">
          <Sparkles className="h-4 w-4" /> Aplicar macro
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AssignmentMenu;
