import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';
import { cn } from '@/lib/utils.js';
import ContextDrawer from './ContextDrawer.jsx';
import SplitLayout from './SplitLayout.jsx';
import { useMediaQuery } from '@/hooks/use-media-query.js';
import useInboxLayoutPreferences, {
  DEFAULT_INBOX_LIST_WIDTH,
  DEFAULT_INBOX_LAYOUT_PREFERENCES,
} from '../../api/useInboxLayoutPreferences.js';
import useUpdateInboxLayoutPreferences from '../../api/useUpdateInboxLayoutPreferences.js';

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
  currentUser,
  toolbar,
}) => {
  const [contextOpen, setContextOpen] = useState(() => readPreference(CONTEXT_PREFERENCE_KEY, defaultContextOpen));
  const [desktopListVisible, setDesktopListVisible] = useState(true);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [listWidth, setListWidth] = useState(DEFAULT_INBOX_LIST_WIDTH);

  useEffect(() => {
    writePreference(CONTEXT_PREFERENCE_KEY, contextOpen);
  }, [contextOpen]);

  const isNarrowViewport = useMediaQuery('(max-width: 1024px)');
  const isDesktop = !isNarrowViewport;

  useEffect(() => {
    if (isDesktop) {
      setMobileListOpen(false);
    }
  }, [isDesktop]);

  const preferencesQuery = useInboxLayoutPreferences();
  const preferences = preferencesQuery.data ?? DEFAULT_INBOX_LAYOUT_PREFERENCES;

  useEffect(() => {
    if (typeof preferences?.inboxListWidth === 'number' && Number.isFinite(preferences.inboxListWidth)) {
      setListWidth(preferences.inboxListWidth);
    }
  }, [preferences?.inboxListWidth]);

  const canPersistPreferences = Boolean(currentUser?.id);

  const effectiveListPosition = 'left';

  const updatePreferences = useUpdateInboxLayoutPreferences({ userId: currentUser?.id });

  const toggleListVisibility = useCallback(() => {
    if (isDesktop) {
      setDesktopListVisible((previous) => !previous);
    } else {
      setMobileListOpen((previous) => !previous);
    }
  }, [isDesktop]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.key === 'l' || event.key === 'L') && event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        toggleListVisibility();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleListVisibility]);

  const handleListWidthChange = useCallback((nextWidth) => {
    setListWidth(nextWidth);
  }, []);

  const handleListWidthCommit = useCallback(
    (nextWidth) => {
      if (canPersistPreferences) {
        updatePreferences.mutate({ inboxListWidth: nextWidth });
      }
    },
    [canPersistPreferences, updatePreferences]
  );

  const listBorderClass = 'border-r border-slate-900/70';

  const renderListPane = useCallback(
    ({ showCloseButton = false } = {}) => (
      <div className="flex h-full flex-col">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-200">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300">
                <MessageSquare className="h-4 w-4" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold leading-none">Inbox</p>
                <p className="text-xs text-slate-400">Atendimento em tempo real</p>
              </div>
            </div>
            {showCloseButton ? (
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-slate-300 hover:text-slate-100"
                  aria-label="Fechar lista de tickets"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </SheetClose>
            ) : null}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-2">{sidebar}</ScrollArea>
        </div>
        <div className="border-t border-slate-900/70 px-4 py-3 text-xs text-slate-500">
          <p className="font-medium text-slate-400">⌥ L alterna lista</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-600">
            {canPersistPreferences ? 'Preferência salva automaticamente' : 'Preferência local temporária'}
          </p>
        </div>
      </div>
    ),
    [sidebar, canPersistPreferences]
  );

  const headerListButtonLabel = desktopListVisible ? 'Ocultar lista' : 'Mostrar lista';
  const detailSurface = (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-slate-950">
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', contextOpen ? 'lg:pr-0' : '')}>{children}</div>
      <ContextDrawer open={contextOpen} onOpenChange={setContextOpen}>
        {context}
      </ContextDrawer>
    </div>
  );

  const listContent = renderListPane();
  const mobileListContent = renderListPane({ showCloseButton: true });

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-slate-300 hover:text-slate-100 lg:hidden"
            onClick={() => setMobileListOpen(true)}
            aria-label="Abrir lista de tickets"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold text-slate-100 sm:text-lg">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 lg:inline-flex"
            onClick={toggleListVisibility}
          >
            {desktopListVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            <span className="ml-2 hidden text-xs font-medium xl:inline">{headerListButtonLabel}</span>
          </Button>
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
        </div>
      </header>
      {toolbar ? (
        <div className="border-b border-slate-900/60 bg-slate-950/95 px-4 py-5">
          <div className="mx-auto w-full max-w-6xl">
            {toolbar}
          </div>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {isDesktop ? (
          <SplitLayout
            className="min-h-0 flex-1"
            list={listContent}
            detail={detailSurface}
            listPosition={effectiveListPosition}
            listClassName={cn('bg-slate-950/90', listBorderClass)}
            detailClassName="bg-slate-950"
            listWidth={listWidth}
            isListVisible={desktopListVisible && Boolean(sidebar)}
            onListWidthChange={handleListWidthChange}
            onListWidthCommit={handleListWidthCommit}
            resizable={desktopListVisible && Boolean(sidebar)}
          />
        ) : (
          detailSurface
        )}
      </div>
      <Sheet open={mobileListOpen} onOpenChange={setMobileListOpen}>
        <SheetContent
          side="left"
          className={cn('w-[min(420px,90vw)] border-slate-900/70 bg-slate-950/95 p-0 text-slate-100', 'border-r')}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Lista de tickets</SheetTitle>
          </SheetHeader>
          {mobileListContent}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default InboxAppShell;
