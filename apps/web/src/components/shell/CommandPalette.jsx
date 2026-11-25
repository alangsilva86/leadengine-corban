import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Route,
  MessageSquare,
  Monitor,
  Moon,
  Search,
  Settings,
  Smartphone,
  Sun,
  Users,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command.jsx';
import { NAVIGATION_PAGES, canAccessPage } from '@/features/navigation/routes.ts';

const PAGE_ICONS = {
  inbox: MessageSquare,
  contacts: Users,
  crm: KanbanSquare,
  dashboard: LayoutDashboard,
  campaigns: Route,
  channels: Smartphone,
  settings: Settings,
};

const PAGE_ORDER = ['inbox', 'contacts', 'crm', 'dashboard', 'campaigns', 'channels', 'settings'];

export const isMacPlatform = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

/** Paleta de comandos (⌘K / Ctrl+K): ir para páginas e executar ações sem o mouse. */
export function CommandPalette({ open, onOpenChange, role, onLogout }) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const pages = useMemo(() => PAGE_ORDER.filter((id) => canAccessPage(id, role)), [role]);

  const run = useCallback(
    (action) => {
      onOpenChange(false);
      action();
    },
    [onOpenChange],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar página ou ação…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nada encontrado para “{query}”.</CommandEmpty>
        <CommandGroup heading="Ir para">
          {pages.map((id) => {
            const page = NAVIGATION_PAGES[id];
            const Icon = PAGE_ICONS[id] ?? Search;
            return (
              <CommandItem key={id} value={`ir ${page.label}`} onSelect={() => run(() => navigate(page.path))}>
                <Icon aria-hidden="true" />
                {page.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ações">
          {canAccessPage('channels', role) ? (
            <CommandItem value="conectar número whatsapp" onSelect={() => run(() => navigate('/channels'))}>
              <Smartphone aria-hidden="true" />
              Conectar número de WhatsApp
            </CommandItem>
          ) : null}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Preferências">
          <CommandItem value="tema claro" onSelect={() => run(() => setTheme('light'))}>
            <Sun aria-hidden="true" />
            Usar tema claro
          </CommandItem>
          <CommandItem value="tema escuro" onSelect={() => run(() => setTheme('dark'))}>
            <Moon aria-hidden="true" />
            Usar tema escuro
          </CommandItem>
          <CommandItem value="tema sistema" onSelect={() => run(() => setTheme('system'))}>
            <Monitor aria-hidden="true" />
            Tema igual ao sistema
          </CommandItem>
          <CommandItem value="sair logout" onSelect={() => run(() => onLogout?.())}>
            <LogOut aria-hidden="true" />
            Sair
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Liga ⌘K / Ctrl+K globalmente (inclusive com foco em campos, como no Linear e no Slack). */
export function useCommandPaletteShortcut(setOpen) {
  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setOpen]);
}

export default CommandPalette;
