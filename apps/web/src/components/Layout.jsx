import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Route,
  MessageSquare,
  Settings,
  Smartphone,
  KanbanSquare,
  Users,
  Menu,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { apiGet } from '@/lib/api.js';
import { useAuth } from '@/features/auth/AuthProvider.jsx';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { NAVIGATION_PAGES, canAccessPage, getNavigationSections } from '@/features/navigation/routes.ts';
import ConnectionStatus from './shell/ConnectionStatus.jsx';
import UserMenu from './shell/UserMenu.jsx';
import BrandMark from './shell/BrandMark.jsx';
import CommandPalette, { isMacPlatform, useCommandPaletteShortcut } from './shell/CommandPalette.jsx';

const NAVIGATION_ICON_MAP = {
  inbox: MessageSquare,
  contacts: Users,
  crm: KanbanSquare,
  dashboard: LayoutDashboard,
  campaigns: Route,
  channels: Smartphone,
  settings: Settings,
};

// Subpáginas mostradas no cabeçalho como "Seção / Subpágina".
const SUBPAGE_LABELS = [
  [/^\/crm\/opportunities/, 'Oportunidades'],
  [/^\/crm\/leads\//, 'Lead'],
  [/^\/contacts\/[^/]+/, 'Detalhes do contato'],
  [/^\/settings\/company/, 'Empresa'],
  [/^\/settings\/users/, 'Equipe'],
  [/^\/settings\/queues/, 'Filas'],
  [/^\/settings\/integrations/, 'Meta Ads'],
  [/^\/settings\/ai/, 'IA'],
  [/^\/settings\/diagnostics/, 'Diagnóstico'],
];

const PAGES_BY_PATH = Object.values(NAVIGATION_PAGES)
  .filter((page) => page.path && page.id !== 'whatsapp' && page.id !== 'baileys-logs')
  .sort((a, b) => b.path.length - a.path.length);

const resolveCurrentPage = (pathname) =>
  PAGES_BY_PATH.find((page) => (page.path === '/' ? pathname === '/' : pathname === page.path || pathname.startsWith(`${page.path}/`))) ??
  null;

const INBOX_COUNT_QUERY_KEY = ['shell', 'inbox-open-count'];

/** Quantidade de conversas abertas para o selo do menu. Leve: pede 1 item e lê o total. */
const useOpenConversationsCount = () =>
  useQuery({
    queryKey: INBOX_COUNT_QUERY_KEY,
    queryFn: async () => {
      const payload = await apiGet('/api/tickets?limit=1&status=OPEN');
      const total = payload?.data?.total ?? payload?.data?.pagination?.total;
      return typeof total === 'number' ? total : null;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });

const formatBadge = (count) => (count > 99 ? '99+' : String(count));

const AppSidebar = ({ user, onLogout, authBusy, activePageId }) => {
  const { isMobile, setOpenMobile } = useSidebar();
  const sections = useMemo(() => getNavigationSections(user?.role), [user?.role]);
  const { data: openCount } = useOpenConversationsCount();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3 py-0">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center"
          aria-label="Lead Engine — ir para a visão geral"
        >
          <BrandMark className="size-8 shrink-0" />
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold text-foreground">Lead Engine</span>
            {user?.tenant?.name ? (
              <span className="block truncate text-xs text-muted-foreground">{user.tenant.name}</span>
            ) : null}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="py-2">
        <nav aria-label="Principal">
          {sections.map((section) => (
            <SidebarGroup key={section.id} className="py-1">
              {section.label ? <SidebarGroupLabel>{section.label}</SidebarGroupLabel> : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((id) => {
                    const page = NAVIGATION_PAGES[id];
                    const Icon = NAVIGATION_ICON_MAP[id] ?? LayoutDashboard;
                    const showBadge = id === 'inbox' && typeof openCount === 'number' && openCount > 0;
                    return (
                      <SidebarMenuItem key={id}>
                        <SidebarMenuButton asChild tooltip={page.label} isActive={activePageId === id}>
                          <NavLink
                            to={page.path}
                            end={page.path === '/'}
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                          >
                            <Icon aria-hidden="true" />
                            <span>{page.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                        {showBadge ? (
                          <SidebarMenuBadge
                            className="rounded-full bg-primary px-1.5 text-2xs font-semibold text-primary-foreground tabular-nums"
                            aria-label={`${openCount} conversas abertas`}
                          >
                            {formatBadge(openCount)}
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu user={user} onLogout={onLogout} disabled={authBusy} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

const AppHeader = ({ currentPage, subpageLabel, canManageChannels, onOpenSearch }) => {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:px-4">
      {isMobile ? (
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Abrir navegação"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      ) : (
        <SidebarTrigger className="text-muted-foreground" />
      )}
      <Separator orientation="vertical" className="mx-1 h-5" />
      <nav aria-label="Você está em" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {currentPage ? (
            <li className={cn('truncate', subpageLabel ? 'text-muted-foreground' : 'font-medium text-foreground')}>
              {subpageLabel ? (
                <Link to={currentPage.path} className="hover:text-foreground">
                  {currentPage.label}
                </Link>
              ) : (
                currentPage.label
              )}
            </li>
          ) : null}
          {subpageLabel ? (
            <>
              <li aria-hidden="true" className="text-subtle-foreground">
                /
              </li>
              <li className="truncate font-medium text-foreground" aria-current="page">
                {subpageLabel}
              </li>
            </>
          ) : null}
        </ol>
      </nav>
      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
        aria-label="Buscar ou ir para (atalho: Ctrl ou Command + K)"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="pr-6">Buscar ou ir para…</span>
        <kbd className="rounded border border-border bg-surface-sunken px-1.5 font-sans text-2xs text-muted-foreground">
          {isMacPlatform() ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>
      <ConnectionStatus canManageChannels={canManageChannels} />
    </header>
  );
};

/**
 * Shell único do app: sidebar + cabeçalho + área de conteúdo.
 * Montado uma vez como rota de layout; as páginas trocam só o conteúdo (sem piscar a navegação).
 */
const Layout = ({ children, fullWidthContent = false }) => {
  const { user, logout, status: authStatus } = useAuth();
  const location = useLocation();
  const mainRef = useRef(null);
  const currentPage = resolveCurrentPage(location.pathname);
  const subpageLabel = SUBPAGE_LABELS.find(([pattern]) => pattern.test(location.pathname))?.[1] ?? null;
  const isFullWidth = fullWidthContent || currentPage?.id === 'inbox';
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(setPaletteOpen);

  // Leva o foco ao conteúdo quando a página muda (leitores de tela anunciam a nova página).
  const previousPathRef = useRef(location.pathname);
  useEffect(() => {
    if (previousPathRef.current === location.pathname) return;
    previousPathRef.current = location.pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <SidebarProvider defaultOpen>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <div className="flex h-svh min-h-0 w-full overflow-hidden bg-background text-foreground">
        <AppSidebar
          user={user}
          onLogout={() => logout?.()}
          authBusy={authStatus === 'checking'}
          activePageId={currentPage?.id}
        />
        <SidebarInset className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader
            currentPage={currentPage}
            subpageLabel={subpageLabel}
            canManageChannels={canAccessPage('channels', user?.role)}
            onOpenSearch={() => setPaletteOpen(true)}
          />
          <main
            id="conteudo"
            ref={mainRef}
            tabIndex={-1}
            className={cn('flex min-h-0 flex-1 flex-col outline-none', isFullWidth ? 'overflow-hidden' : 'overflow-y-auto')}
          >
            {isFullWidth ? (
              children
            ) : (
              <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
                {children}
              </div>
            )}
          </main>
        </SidebarInset>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={user?.role} onLogout={() => logout?.()} />
    </SidebarProvider>
  );
};

export default Layout;
