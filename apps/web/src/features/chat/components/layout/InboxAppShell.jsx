import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
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

const ListPanelHeader = ({ showCloseButton = false }) => (
  <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] px-4 py-3 text-sm font-semibold text-[color:var(--color-inbox-foreground)]">
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_18%,transparent)] text-[color:var(--accent-inbox-primary)] shadow-[var(--shadow-sm)]">
        <MessageSquare className="h-4 w-4" />
      </span>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold leading-none">Inbox</p>
        <p className="text-xs text-[color:var(--color-inbox-foreground-muted)]">Atendimento em tempo real</p>
      </div>
    </div>
    {showCloseButton ? (
      <SheetClose asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full text-[color:var(--color-inbox-foreground-muted)] hover:text-[color:var(--color-inbox-foreground)]"
          aria-label="Fechar lista de tickets"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </SheetClose>
    ) : null}
  </div>
);

const ListPanelContent = ({ children }) => (
  <div className="flex min-h-0 min-w-0 flex-col px-3 py-4">{children}</div>
);

const ListPanelFooter = ({ canPersistPreferences }) => (
  <div className="shrink-0 border-t border-[color:var(--color-inbox-border)] px-4 py-3 text-[11px] text-[color:var(--color-inbox-foreground-muted)]">
    <p className="font-medium">⌥ L alterna lista</p>
    <p className="mt-1 uppercase tracking-wide">
      {canPersistPreferences ? 'Preferência salva automaticamente' : 'Preferência local temporária'}
    </p>
  </div>
);

const ListPanel = ({ sidebar, canPersistPreferences, showCloseButton = false }) => (
  <div className="flex h-full min-h-0 min-w-0 flex-col">
    <div
      className="chat-scroll-area flex flex-1 min-h-0 flex-col overflow-y-auto overscroll-contain"
      style={{ scrollbarGutter: 'stable' }}
    >
      <ListPanelHeader showCloseButton={showCloseButton} />
      <ListPanelContent>{sidebar}</ListPanelContent>
    </div>
    <ListPanelFooter canPersistPreferences={canPersistPreferences} />
  </div>
);

const DesktopToolbar = ({
  onToggleListVisibility,
  onToggleContext,
  contextOpen,
  desktopListVisible,
  headerListButtonLabel,
}) => (
  <div className="flex items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      className="hidden border-[color:var(--border-shell)] bg-surface-shell-subtle text-[color:var(--text-shell-muted)] hover:bg-surface-shell lg:inline-flex"
      onClick={onToggleListVisibility}
    >
      {desktopListVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      <span className="ml-2 hidden text-xs font-medium xl:inline">{headerListButtonLabel}</span>
    </Button>
    <Button
      variant="outline"
      size="sm"
      className="border-[color:var(--border-shell)] bg-surface-shell-subtle text-[color:var(--text-shell-muted)] hover:bg-surface-shell"
      onClick={onToggleContext}
    >
      {contextOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      <span className="ml-2 hidden text-xs font-medium sm:inline">
        {contextOpen ? 'Ocultar painel' : 'Exibir painel'}
      </span>
    </Button>
  </div>
);

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

  const headerListButtonLabel = desktopListVisible ? 'Ocultar lista' : 'Mostrar lista';
  const renderDetailSurface = () => {
    const detailGap = contextOpen ? 'lg:gap-6' : 'lg:gap-0';

    return (
      <div className={cn('flex h-full min-h-0 w-full flex-col lg:flex-row', detailGap)}>
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-3xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] shadow-[var(--shadow-lg)]">
            {children}
          </div>
        </div>
        <ContextDrawer
          open={contextOpen}
          onOpenChange={setContextOpen}
          desktopClassName="rounded-3xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] shadow-[var(--shadow-lg)]"
          desktopContentClassName="px-4 py-5"
        >
          {context}
        </ContextDrawer>
      </div>
    );
  };

  const listContent = useMemo(
    () => (
      <ListPanel sidebar={sidebar} canPersistPreferences={canPersistPreferences} />
    ),
    [sidebar, canPersistPreferences]
  );

  const mobileListContent = useMemo(
    () => (
      <ListPanel sidebar={sidebar} canPersistPreferences={canPersistPreferences} showCloseButton />
    ),
    [sidebar, canPersistPreferences]
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-surface-shell text-foreground">
      <div className="sticky top-0 z-40 flex flex-col border-b border-[color:var(--border-shell)] bg-surface-toolbar/95 backdrop-blur-xl supports-[backdrop-filter]:bg-surface-toolbar">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
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
          <DesktopToolbar
            onToggleListVisibility={toggleListVisibility}
            onToggleContext={() => setContextOpen((previous) => !previous)}
            contextOpen={contextOpen}
            desktopListVisible={desktopListVisible}
            headerListButtonLabel={headerListButtonLabel}
          />
        </header>
        {toolbar ? (
          <div className="border-t border-[color:var(--border-shell)] px-4 py-3 sm:px-5">
            <div className="mx-auto w-full max-w-6xl">{toolbar}</div>
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-1 min-h-0">
          {isDesktop ? (
            <SplitLayout
              className="h-full w-full gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6"
              list={listContent}
              detail={renderDetailSurface()}
              listClassName={cn(
                'flex min-h-0 flex-col rounded-3xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] shadow-[var(--shadow-lg)]'
              )}
              detailClassName="min-h-0 min-w-0"
              listWidth={listWidth}
              isListVisible={desktopListVisible && Boolean(sidebar)}
              onListWidthChange={handleListWidthChange}
              onListWidthCommit={handleListWidthCommit}
              resizable={desktopListVisible && Boolean(sidebar)}
            />
          ) : (
            <div className="flex h-full w-full px-4 py-4 sm:px-6 sm:py-6">
              {renderDetailSurface()}
            </div>
          )}
        </div>
      </div>
      <Sheet open={mobileListOpen} onOpenChange={setMobileListOpen}>
        <SheetContent
          side="left"
          className={cn(
            'w-[min(420px,90vw)] border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-0 text-foreground shadow-[var(--shadow-lg)]',
            'border-r'
          )}
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
