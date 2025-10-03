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
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-white">
          <EllipsisVertical className="h-4 w-4" />
          <span className="sr-only">Ações rápidas</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px] bg-slate-950/95 text-slate-100">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAssign} className="gap-2 text-slate-200">
          <UserPlus className="h-4 w-4" /> Atribuir a mim
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onTransfer} className="gap-2 text-slate-200">
          <UserRoundPlus className="h-4 w-4" /> Transferir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMute} className="gap-2 text-slate-200">
          <BellOff className="h-4 w-4" /> Silenciar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onFollowUp} className="gap-2 text-slate-200">
          <StickyNote className="h-4 w-4" /> Marcar follow-up
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onMacro} className="gap-2 text-slate-200">
          <Sparkles className="h-4 w-4" /> Aplicar macro
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AssignmentMenu;
