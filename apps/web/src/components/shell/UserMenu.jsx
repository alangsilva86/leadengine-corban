import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { SidebarMenuButton } from '@/components/ui/sidebar.jsx';
import { ROLE_LABELS } from '@/features/navigation/routes.ts';
import { getInitials } from '@/lib/initials';

const UserAvatar = ({ name, className = '' }) => (
  <span
    aria-hidden="true"
    className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground ${className}`}
  >
    {getInitials(name, { singleWordLetters: 1 })}
  </span>
);

/** Menu da conta no rodapé da sidebar: identidade, tema, configurações e sair. */
export function UserMenu({ user, onLogout, disabled = false }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const name = user?.name || user?.email || 'Sua conta';
  const roleLabel = ROLE_LABELS[user?.role] ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-surface-hover" aria-label={`Menu da conta de ${name}`}>
          <UserAvatar name={name} />
          <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium text-foreground">{name}</span>
            {roleLabel ? <span className="truncate text-xs text-muted-foreground">{roleLabel}</span> : null}
          </span>
          <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden="true" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          {user?.email && user.email !== name ? <p className="truncate text-xs text-muted-foreground">{user.email}</p> : null}
          {user?.tenant?.name ? <p className="truncate text-xs text-muted-foreground">{user.tenant.name}</p> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mounted ? theme ?? 'system' : 'system'} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" aria-hidden="true" /> Claro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" aria-hidden="true" /> Escuro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" aria-hidden="true" /> Igual ao sistema
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="size-4" aria-hidden="true" /> Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onLogout?.()} disabled={disabled}>
          <LogOut className="size-4" aria-hidden="true" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;
