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

  const renderListPane = useCallback(
    ({ showCloseButton = false } = {}) => (
      <div className="flex h-full flex-col">
        <div className="px-5 pb-4 pt-5">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300 shadow-inner shadow-slate-950/50">
                <MessageSquare className="h-4 w-4" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold leading-none">Inbox</p>
                <p className="text-xs text-[color:var(--text-shell-muted)]">Atendimento em tempo real</p>
              </div>
            </div>
            {showCloseButton ? (
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-[color:var(--text-shell-muted)] hover:text-foreground"
                  aria-label="Fechar lista de tickets"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </SheetClose>
            ) : null}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-2 pb-6">{sidebar}</ScrollArea>
        </div>
        <div className="px-5 pb-5 pt-4 text-xs text-[color:var(--text-shell-muted)]">
          <p className="font-medium text-[color:var(--text-shell-muted)]">⌥ L alterna lista</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-[color:var(--text-shell-muted)]">
            {canPersistPreferences ? 'Preferência salva automaticamente' : 'Preferência local temporária'}
          </p>
        </div>
      </div>
    ),
    [sidebar, canPersistPreferences]
  );

  const headerListButtonLabel = desktopListVisible ? 'Ocultar lista' : 'Mostrar lista';
  const renderDetailSurface = () => {
    const detailGap = contextOpen ? 'lg:gap-6' : 'lg:gap-0';

    return (
      <div className={cn('flex h-full min-h-0 w-full flex-col lg:flex-row', detailGap)}>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] bg-surface-shell-subtle p-0 shadow-xl ring-1 ring-[color:var(--ring-shell)] backdrop-blur-xl">
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-5 pt-5 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </div>
        <ContextDrawer
          open={contextOpen}
          onOpenChange={setContextOpen}
          desktopClassName="rounded-[32px] bg-surface-shell-muted shadow-xl ring-1 ring-[color:var(--ring-shell)] backdrop-blur-xl"
          desktopContentClassName="px-5 py-6"
        >
          {context}
        </ContextDrawer>
      </div>
    );
  };

  const listContent = renderListPane();
  const mobileListContent = renderListPane({ showCloseButton: true });

  return (
    <div className="flex min-h-screen flex-col bg-surface-shell text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-surface-toolbar px-4 py-3 shadow-[0_24px_48px_-36px_rgba(15,23,42,0.9)] supports-[backdrop-filter]:bg-surface-toolbar-muted backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-[color:var(--text-shell-muted)] hover:text-foreground lg:hidden"
            onClick={() => setMobileListOpen(true)}
            aria-label="Abrir lista de tickets"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold text-foreground sm:text-lg">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden border-[color:var(--border-shell)] bg-surface-shell-subtle text-[color:var(--text-shell-muted)] hover:bg-surface-shell lg:inline-flex"
            onClick={toggleListVisibility}
          >
            {desktopListVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            <span className="ml-2 hidden text-xs font-medium xl:inline">{headerListButtonLabel}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-[color:var(--border-shell)] bg-surface-shell-subtle text-[color:var(--text-shell-muted)] hover:bg-surface-shell"
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
        <div className="bg-surface-toolbar px-4 py-4 shadow-[0_20px_48px_-36px_rgba(15,23,42,0.8)] supports-[backdrop-filter]:bg-surface-toolbar-muted backdrop-blur-xl">
          <div className="mx-auto w-full max-w-6xl">
            {toolbar}
          </div>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-1">
          {isDesktop ? (
            <SplitLayout
              className="h-full w-full gap-6 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6"
              list={listContent}
              detail={renderDetailSurface()}
              listPosition={effectiveListPosition}
              listClassName={cn(
                'flex flex-col overflow-hidden rounded-[28px] bg-surface-shell-muted shadow-xl ring-1 ring-[color:var(--ring-shell)] backdrop-blur-xl'
              )}
              detailClassName="min-h-0 min-w-0"
              listWidth={listWidth}
              isListVisible={desktopListVisible && Boolean(sidebar)}
              onListWidthChange={handleListWidthChange}
              onListWidthCommit={handleListWidthCommit}
              resizable={desktopListVisible && Boolean(sidebar)}
            />
          ) : (
            <div className="flex h-full w-full px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6">
              {renderDetailSurface()}
            </div>
          )}
        </div>
      </div>
      <Sheet open={mobileListOpen} onOpenChange={setMobileListOpen}>
        <SheetContent
          side="left"
          className={cn('w-[min(420px,90vw)] border-[color:var(--border-shell)] bg-surface-shell-muted p-0 text-foreground backdrop-blur-xl', 'border-r')}
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
