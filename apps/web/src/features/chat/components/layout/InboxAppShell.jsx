import { useEffect, useState } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
} from '@/components/ui/sidebar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { cn } from '@/lib/utils.js';
import { PanelRightOpen, PanelRightClose, MessageSquare } from 'lucide-react';
import ContextDrawer from './ContextDrawer.jsx';

const CONTEXT_PREFERENCE_KEY = 'inbox_context_open';

const readPreference = (key, fallback) => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) {
      return fallback;
    }
    return stored === 'true';
  } catch (error) {
    console.warn('Failed to read preference', { key, error });
    return fallback;
  }
};

const writePreference = (key, value) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch (error) {
    console.warn('Failed to persist preference', { key, error });
  }
};

const InboxAppShell = ({
  sidebar,
  children,
  context,
  defaultContextOpen = false,
  title = 'Inbox de Leads',
}) => {
  const [contextOpen, setContextOpen] = useState(() => readPreference(CONTEXT_PREFERENCE_KEY, defaultContextOpen));

  useEffect(() => {
    writePreference(CONTEXT_PREFERENCE_KEY, contextOpen);
  }, [contextOpen]);

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen bg-slate-950 text-slate-100">
        <Sidebar collapsible="icon" className="border-slate-900/80 bg-slate-950/90">
          <SidebarHeader className="px-3 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300">
                <MessageSquare className="h-4 w-4" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold leading-none">Inbox</p>
                <p className="text-xs text-slate-400">Atendimento em tempo real</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent className="px-2">
            <ScrollArea className="h-full pr-2">{sidebar}</ScrollArea>
          </SidebarContent>
          <SidebarFooter className="px-2 pb-4 text-xs text-slate-500">
            <p>⌘B recolhe barra lateral</p>
          </SidebarFooter>
        </Sidebar>
        <SidebarRail />
        <SidebarInset className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-900/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-slate-300" />
              <h1 className="text-base font-semibold text-slate-100 sm:text-lg">{title}</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900"
              onClick={() => setContextOpen((previous) => !previous)}
            >
              {contextOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              <span className="ml-2 hidden text-xs font-medium sm:inline">
                {contextOpen ? 'Ocultar painel' : 'Exibir painel'}
              </span>
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className={cn('flex-1 overflow-hidden', contextOpen ? 'lg:pr-0' : '')}>{children}</div>
            <ContextDrawer open={contextOpen} onOpenChange={setContextOpen}>
              {context}
            </ContextDrawer>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default InboxAppShell;
