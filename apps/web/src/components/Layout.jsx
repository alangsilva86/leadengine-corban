import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Menu,
  Home,
  Users,
  Briefcase,
  QrCode,
  MessageSquare,
  BarChart3,
  Settings,
  Ticket,
  Bell,
  Search,
  User,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
  ScrollText,
  Bug,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { isWhatsAppDebugEnabled } from '@/features/debug/featureFlags.js';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar.jsx';
import HealthIndicator from './HealthIndicator.jsx';
import TenantSelector from './TenantSelector.jsx';
import { getRuntimeEnv } from '@/lib/runtime-env.js';
import { getFrontendFeatureFlags } from '../../../../config/feature-flags.ts';

const frontendFeatureFlags = getFrontendFeatureFlags(getRuntimeEnv());
const shouldShowWhatsappDebug = frontendFeatureFlags.whatsappDebug;
const showWhatsappDebug = isWhatsAppDebugEnabled() || shouldShowWhatsappDebug;

const NAVIGATION_ITEMS = (() => {
  const items = [
    { id: 'dashboard', label: 'Visão Geral', icon: Home },
    { id: 'contacts', label: 'Contatos', icon: Users },
    { id: 'agreements', label: 'Convênios', icon: Briefcase },
    { id: 'whatsapp', label: 'WhatsApp', icon: QrCode },
    { id: 'inbox', label: 'Inbox', icon: MessageSquare },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    ...(showWhatsappDebug ? [{ id: 'whatsapp-debug', label: 'Debug WhatsApp', icon: Bug }] : []),
    { id: 'baileys-logs', label: 'Logs Baileys', icon: ScrollText },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];
 
  return items;
})();

const LayoutHeader = ({ children, className }) => (
  <header
    className={cn(
      'flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6',
      className
    )}
  >
    {children}
  </header>
);

const LayoutContent = ({
  children,
  className,
  stickyFooterPaddingClass,
  disableInnerWrapper = false,
}) => (
  <div className={cn('page-content flex flex-1 min-h-0 flex-col', className)}>
    {disableInnerWrapper ? (
      children
    ) : (
      <div
        className={cn(
          'page-content-inner mx-auto flex w-full max-w-7xl flex-1 min-h-0 flex-col gap-6 overflow-y-auto p-6 md:p-8',
          stickyFooterPaddingClass
        )}
      >
        {children}
      </div>
    )}
  </div>
);

const OnboardingTrack = ({ stages, activeStep }) => {
  if (!stages?.length) {
    return null;
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border/60 bg-muted/60 p-1.5 pr-2 text-xs">
      {stages.map((stage, index) => {
        const status =
          index < activeStep ? 'done' : index === activeStep ? 'current' : 'todo';

        return (
          <div
            key={stage.id}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors',
              status === 'done' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
              status === 'current' && 'bg-primary/10 text-primary',
              status === 'todo' && 'text-muted-foreground'
            )}
          >
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full border text-[0.65rem] font-semibold',
                status === 'done' && 'border-transparent bg-emerald-500 text-emerald-50',
                status === 'current' && 'border-transparent bg-primary text-primary-foreground',
                status === 'todo' && 'border-transparent bg-muted text-muted-foreground'
              )}
            >
              {index + 1}
            </span>
            <span className="whitespace-nowrap">{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const LayoutShell = ({
  children,
  navigation,
  currentPage,
  onNavigate,
  shouldShowOnboardingTrack,
  stageList,
  activeOnboardingStep,
  isDarkMode,
  themeMounted,
  setTheme,
  fullWidthContent = false,
}) => {
  const { isMobile, state, setOpen, setOpenMobile, toggleSidebar } = useSidebar();
  const isSidebarCollapsed = state === 'collapsed';

  const handleNavigate = (page) => (event) => {
    event.preventDefault();
    onNavigate?.(page);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSidebarCollapseToggle = () => {
    if (isMobile) {
      setOpenMobile(true);
      return;
    }

    toggleSidebar();
  };

  const handleMobileSidebarOpen = () => {
    if (isMobile) {
      setOpenMobile(true);
    } else {
      setOpen(true);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background text-foreground">
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Ticket className="h-5 w-5" />
            </div>
            <div className="space-y-1 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-semibold leading-none">Lead Engine</p>
              <p className="text-xs text-muted-foreground">Máquina de Vendas</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 py-4">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      type="button"
                      onClick={handleNavigate(item.id)}
                      isActive={currentPage === item.id}
                      tooltip={item.label}
                      aria-label={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="truncate group-data-[collapsible=icon]:hidden">
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium leading-none">João Silva</p>
              <p className="text-xs text-muted-foreground">Agente</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sair</span>
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <LayoutHeader>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={handleMobileSidebarOpen}
              aria-label="Abrir navegação"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={handleSidebarCollapseToggle}
              aria-label={isSidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
              title={isSidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
            >
              {isSidebarCollapsed ? (
                <ChevronsRight className="h-5 w-5" />
              ) : (
                <ChevronsLeft className="h-5 w-5" />
              )}
            </Button>
            <div className="relative hidden min-w-0 flex-1 items-center sm:flex">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar tickets, contatos..."
                className="h-9 w-full rounded-lg border border-border bg-muted/40 pl-9 text-sm shadow-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
              aria-label={isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {themeMounted ? (
                isDarkMode ? (
                  <Moon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Sun className="h-5 w-5" aria-hidden="true" />
                )
              ) : (
                <Sun className="h-5 w-5 opacity-0" aria-hidden="true" />
              )}
              <span className="sr-only">Alternar tema</span>
            </Button>
            <TenantSelector />
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[0.65rem] font-medium text-primary-foreground">
                5
              </span>
            </Button>
            <HealthIndicator />
          </div>
        </LayoutHeader>
        <div className="px-4 py-4 sm:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar tickets, contatos..."
              className="h-9 w-full rounded-lg border border-border bg-muted/40 pl-9 text-sm shadow-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <LayoutContent className="h-full min-h-0" disableInnerWrapper={fullWidthContent}>
          {shouldShowOnboardingTrack ? (
            <OnboardingTrack stages={stageList} activeStep={activeOnboardingStep} />
          ) : null}
          {children}
        </LayoutContent>
      </SidebarInset>
    </div>
  );
};

const Layout = ({
  children,
  currentPage = 'dashboard',
  onNavigate,
  onboarding,
  fullWidthContent = false,
}) => {
  const [inboxCount, setInboxCount] = useState(
    typeof onboarding?.metrics?.inboxCount === 'number' ? onboarding.metrics.inboxCount : null
  );
  const [themeMounted, setThemeMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (typeof onboarding?.metrics?.inboxCount === 'number') {
      setInboxCount(onboarding.metrics.inboxCount);
    }
  }, [onboarding?.metrics?.inboxCount]);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handler = (event) => {
      if (typeof event?.detail === 'number') {
        setInboxCount(event.detail);
      }
    };
    window.addEventListener('leadengine:inbox-count', handler);
    return () => window.removeEventListener('leadengine:inbox-count', handler);
  }, []);

  const navigation = useMemo(
    () =>
      NAVIGATION_ITEMS.map((item) => {
        if (item.id !== 'inbox') {
          return item;
        }

        const inboxLabel =
          typeof inboxCount === 'number' ? `Inbox (${inboxCount})` : 'Inbox';

        return {
          ...item,
          label: inboxLabel,
        };
      }),
    [inboxCount]
  );

  const stageList = onboarding?.stages ?? [];

  const shouldShowOnboardingTrack = stageList.length > 0 && currentPage !== 'inbox';
  const isDarkMode = themeMounted ? resolvedTheme === 'dark' : false;
  const activeOnboardingStep = onboarding?.activeStep ?? 0;

  return (
    <SidebarProvider>
      <LayoutShell
        navigation={navigation}
        currentPage={currentPage}
        onNavigate={onNavigate}
        shouldShowOnboardingTrack={shouldShowOnboardingTrack}
        stageList={stageList}
        activeOnboardingStep={activeOnboardingStep}
        isDarkMode={isDarkMode}
        themeMounted={themeMounted}
        setTheme={setTheme}
        fullWidthContent={fullWidthContent}
      >
        {children}
      </LayoutShell>
    </SidebarProvider>
  );
};

export default Layout;
