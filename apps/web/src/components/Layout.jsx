import { useEffect, useState } from 'react';
import {
  Home,
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
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar.jsx';
import { cn } from '@/lib/utils.js';
import HealthIndicator from './HealthIndicator.jsx';
import TenantSelector from './TenantSelector.jsx';
import DemoAuthDialog from './DemoAuthDialog.jsx';

const Layout = ({ children, currentPage = 'dashboard', onNavigate, onboarding }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const inboxLabel = typeof inboxCount === 'number' ? `Inbox (${inboxCount})` : 'Inbox';

  const navigation = [
    { id: 'dashboard', name: 'Visão Geral', icon: Home },
    { id: 'agreements', name: 'Convênios', icon: Briefcase },
    { id: 'whatsapp', name: 'WhatsApp', icon: QrCode },
    {
      id: 'inbox',
      name: inboxLabel,
      icon: MessageSquare,
    },
    { id: 'reports', name: 'Relatórios', icon: BarChart3 },
    { id: 'settings', name: 'Configurações', icon: Settings },
  ];

  const stageList = onboarding?.stages ?? [];

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shouldShowOnboardingTrack = stageList.length > 0 && currentPage !== 'inbox';
  const isDarkMode = themeMounted ? resolvedTheme === 'dark' : false;

  return (
    <SidebarProvider
      defaultOpen
      open={!sidebarCollapsed}
      onOpenChange={(open) => setSidebarCollapsed(!open)}
      className="bg-background text-foreground"
    >
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarContent className="gap-0">
          <SidebarBrand />
          <SidebarNavigation
            navigation={navigation}
            currentPage={currentPage}
            onNavigate={onNavigate}
          />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border px-3 py-4">
          <SidebarUserFooter />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <LayoutHeader
          isDarkMode={isDarkMode}
          onToggleTheme={() => setTheme(isDarkMode ? 'light' : 'dark')}
          themeMounted={themeMounted}
        />
        <main className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            {shouldShowOnboardingTrack ? (
              <OnboardingTrack stages={stageList} activeStep={onboarding.activeStep} />
            ) : null}
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;

const SidebarBrand = () => {
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary-foreground">
            <Ticket className="h-5 w-5" />
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:hidden">
            <h1 className="text-lg font-semibold leading-tight">Lead Engine</h1>
            <p className="text-xs text-muted-foreground">Maquina de Vendas</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpenMobile(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar menu</span>
        </Button>
      </div>
    </SidebarHeader>
  );
};

const SidebarNavigation = ({ navigation, currentPage, onNavigate }) => {
  const { setOpenMobile } = useSidebar();

  const handleNavigate = (page) => (event) => {
    event.preventDefault();
    onNavigate?.(page);
    setOpenMobile(false);
  };

  return (
    <SidebarGroup className="px-2 py-4">
      <SidebarGroupContent>
        <SidebarMenu>
          {navigation.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                onClick={handleNavigate(item.id)}
                isActive={currentPage === item.id}
                tooltip={item.name}
                className="transition-colors"
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1 truncate">{item.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

const SidebarUserFooter = () => {
  return (
    <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20">
        <User className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <p className="truncate text-sm font-medium">João Silva</p>
        <p className="text-xs text-muted-foreground">Agente</p>
      </div>
      <Button variant="ghost" size="icon" className="ml-auto">
        <LogOut className="h-4 w-4" />
        <span className="sr-only">Sair</span>
      </Button>
    </div>
  );
};

const LayoutHeader = ({ isDarkMode, onToggleTheme, themeMounted }) => {
  const { state, setOpen } = useSidebar();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-4 py-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-2 md:gap-3">
        <SidebarTrigger className="md:hidden" />
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          onClick={() => setOpen((previous) => !previous)}
          aria-label={state === 'collapsed' ? 'Expandir sidebar' : 'Recolher sidebar'}
          title={state === 'collapsed' ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {state === 'collapsed' ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <ChevronsLeft className="h-5 w-5" />
          )}
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar tickets, contatos..."
            className="w-48 rounded-lg pl-9 sm:w-64 lg:w-72"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
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
        <DemoAuthDialog />
        <TenantSelector />
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="bg-primary text-primary-foreground absolute -right-1.5 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[0.65rem] font-semibold leading-none">
            5
          </span>
        </Button>
        <HealthIndicator />
      </div>
    </header>
  );
};

const OnboardingTrack = ({ stages, activeStep }) => {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/60 p-1.5"
      aria-label="Progresso do onboarding"
    >
      {stages.map((stage, index) => {
        const status =
          index < activeStep ? 'done' : index === activeStep ? 'current' : 'todo';

        return (
          <div
            key={stage.id}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              onboardingPillStyles[status]
            )}
          >
            <span
              className={cn(
                'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[0.65rem]',
                onboardingIndexStyles[status]
              )}
            >
              {index + 1}
            </span>
            <span className="truncate">{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const onboardingPillStyles = {
  todo: 'bg-transparent text-muted-foreground',
  current: 'bg-primary/20 text-primary-foreground',
  done: 'bg-emerald-500/20 text-emerald-100',
};

const onboardingIndexStyles = {
  todo: 'border-border/60 text-muted-foreground',
  current: 'border-transparent bg-primary text-primary-foreground',
  done: 'border-transparent bg-emerald-500 text-emerald-950',
};
