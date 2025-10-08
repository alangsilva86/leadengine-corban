'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
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
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';
import HealthIndicator from './HealthIndicator.jsx';
import TenantSelector from './TenantSelector.jsx';
import DemoAuthDialog from './DemoAuthDialog.jsx';
import { cva } from 'class-variance-authority';

const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Visão Geral', icon: Home },
  { id: 'agreements', label: 'Convênios', icon: Briefcase },
  { id: 'whatsapp', label: 'WhatsApp', icon: QrCode },
  { id: 'inbox', label: 'Inbox', icon: MessageSquare },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

const LAYOUT_CONTENT_WRAPPER = 'mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8';
const LAYOUT_MAIN_CLASS = 'flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:px-8';
const NOTIFICATION_COUNT = 5;

const Layout = ({ children, currentPage = 'dashboard', onNavigate, onboarding }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

  const navigation = useMemo(() => {
    return NAVIGATION_ITEMS.map((item) =>
      item.id === 'inbox' && typeof inboxCount === 'number'
        ? { ...item, badge: inboxCount }
        : item
    );
  }, [inboxCount]);

  const stageList = onboarding?.stages ?? [];
  const activeStep = typeof onboarding?.activeStep === 'number' ? onboarding.activeStep : 0;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(true);
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
      open={isSidebarOpen}
      onOpenChange={setIsSidebarOpen}
      className="bg-background text-foreground"
    >
      <Sidebar collapsible="icon" className="border-r border-sidebar-border/60 bg-sidebar">
        <SidebarBrand />
        <SidebarContent className="gap-0 px-2 py-4">
          <SidebarNavigation
            navigation={navigation}
            currentPage={currentPage}
            onNavigate={onNavigate}
          />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border/60 px-3 py-4">
          <SidebarUserFooter />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <LayoutHeader
          isDarkMode={isDarkMode}
          onToggleTheme={() => setTheme(isDarkMode ? 'light' : 'dark')}
          themeMounted={themeMounted}
          notifications={NOTIFICATION_COUNT}
        />
        <main className={LAYOUT_MAIN_CLASS}>
          <div className={LAYOUT_CONTENT_WRAPPER}>
            {shouldShowOnboardingTrack ? (
              <OnboardingTrack stages={stageList} activeStep={activeStep} />
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
    <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-4">
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

  const handleNavigate = useCallback(
    (page) => (event) => {
      event.preventDefault();
      onNavigate?.(page);
      setOpenMobile(false);
    },
    [onNavigate, setOpenMobile]
  );

  return (
    <SidebarGroup className="gap-3">
      <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60 group-data-[collapsible=icon]:sr-only">
        Navegação
      </SidebarGroupLabel>
      <SidebarGroupContent className="px-1.5">
        <SidebarMenu>
          {navigation.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                onClick={handleNavigate(item.id)}
                isActive={currentPage === item.id}
                tooltip={item.label}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1 truncate">{item.label}</span>
                {typeof item.badge === 'number' ? (
                  <SidebarMenuBadge className="bg-sidebar-primary text-sidebar-primary-foreground">
                    {item.badge}
                  </SidebarMenuBadge>
                ) : null}
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
    <SidebarMenu className="w-full">
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="gap-3"
          tooltip="Conta do usuário"
          aria-label="Conta do usuário"
          type="button"
        >
          <Avatar className="size-10">
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              JS
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-left group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold leading-tight">João Silva</p>
            <p className="text-xs text-muted-foreground">Agente</p>
          </div>
        </SidebarMenuButton>
        <SidebarMenuAction
          aria-label="Sair"
          title="Sair"
          className="text-muted-foreground hover:text-destructive"
          type="button"
        >
          <LogOut className="h-4 w-4" />
        </SidebarMenuAction>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

const LayoutHeader = ({ isDarkMode, onToggleTheme, themeMounted, notifications }) => {
  const { state, setOpen } = useSidebar();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
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
            aria-label="Buscar tickets e contatos"
            className="w-48 rounded-lg pl-9 sm:w-64 lg:w-72 xl:w-80"
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
          {notifications > 0 ? (
            <Badge
              variant="secondary"
              className="absolute -right-1.5 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center px-1 text-[0.65rem] font-semibold leading-none"
            >
              {notifications}
            </Badge>
          ) : null}
        </Button>
        <HealthIndicator />
      </div>
    </header>
  );
};

const OnboardingTrack = ({ stages, activeStep }) => {
  return (
    <nav aria-label="Progresso do onboarding">
      <ol className="flex flex-wrap items-center gap-2 rounded-full border border-border/60 bg-muted/60 p-1.5">
        {stages.map((stage, index) => {
          const status = index < activeStep ? 'done' : index === activeStep ? 'current' : 'todo';

          return (
            <li key={stage.id} className="max-w-full">
              <span
                className={cn(onboardingPillVariants({ status }))}
                data-status={status}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <span className={cn(onboardingIndexVariants({ status }))}>{index + 1}</span>
                <span className="truncate">{stage.label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

const onboardingPillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
  {
    variants: {
      status: {
        todo: 'bg-transparent text-muted-foreground',
        current: 'bg-primary/20 text-primary-foreground',
        done: 'bg-emerald-500/20 text-emerald-100',
      },
    },
    defaultVariants: {
      status: 'todo',
    },
  }
);

const onboardingIndexVariants = cva(
  'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold',
  {
    variants: {
      status: {
        todo: 'border-border/60 text-muted-foreground',
        current: 'border-transparent bg-primary text-primary-foreground',
        done: 'border-transparent bg-emerald-500 text-emerald-950',
      },
    },
    defaultVariants: {
      status: 'todo',
    },
  }
);
