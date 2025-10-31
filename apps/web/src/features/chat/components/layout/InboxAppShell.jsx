import { useEffect, useMemo, useRef } from 'react';
import { MessageSquare, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';
import { cn } from '@/lib/utils.js';
import ContextDrawer from './ContextDrawer.jsx';
import SplitLayout from './SplitLayout.jsx';
import useInboxLayoutState from './hooks/useInboxLayoutState.js';
import { createScrollMemory, LIST_SCROLL_STORAGE_KEY } from './preferences.ts';

const listScrollMemory = createScrollMemory(LIST_SCROLL_STORAGE_KEY);

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

const ListPanelContent = ({ children }) => <div className="flex min-h-0 min-w-0 flex-col">{children}</div>;

const ListPanelFooter = ({ canPersistPreferences }) => (
  <div className="shrink-0 border-t border-[color:var(--color-inbox-border)] px-4 py-3 text-[11px] text-[color:var(--color-inbox-foreground-muted)]">
    <p className="font-medium">⌥ L alterna lista</p>
    <p className="mt-1 uppercase tracking-wide">
      {canPersistPreferences ? 'Preferência salva automaticamente' : 'Preferência local temporária'}
    </p>
  </div>
);

const ListPanel = ({ sidebar, canPersistPreferences, showCloseButton = false }) => {
  const viewportRef = useRef(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;

    const restore = () => {
      const saved = listScrollMemory.read();
      if (typeof saved === 'number') {
        requestAnimationFrame(() => {
          element.scrollTop = saved;
        });
      }
    };

    restore();

    const handleScroll = () => {
      listScrollMemory.write(element.scrollTop);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      listScrollMemory.write(element.scrollTop);
      element.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col" data-pane="sidebar">
      <ListPanelHeader showCloseButton={showCloseButton} />
      <div
        ref={viewportRef}
        id="listViewport"
        className="chat-scroll-area min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable_both-edges] [overflow-clip-margin:24px]"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="px-4 py-4">
          <ListPanelContent>{sidebar}</ListPanelContent>
        </div>
      </div>
      <ListPanelFooter canPersistPreferences={canPersistPreferences} />
    </div>
  );
};

const DesktopToolbar = ({
  onToggleListVisibility,
  onToggleContext,
  contextOpen,
  desktopListVisible,
  headerListButtonLabel,
  showContextToggle = true,
}) => (
  <div className="flex items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      className="hidden border-[color:var(--border-shell)] bg-surface-shell-subtle text-[color:var(--text-shell-muted)] hover:bg-surface-shell xl:inline-flex"
      onClick={onToggleListVisibility}
    >
      {desktopListVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      <span className="ml-2 hidden text-xs font-medium xl:inline">{headerListButtonLabel}</span>
    </Button>
    {showContextToggle ? (
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
    ) : null}
  </div>
);

const DetailSurface = ({ children, context, contextOpen, onContextOpenChange }) => {
  const detailGap = contextOpen ? 'lg:gap-6' : 'lg:gap-0';

  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col items-stretch lg:flex-row', detailGap)}>
      <div className="flex h-full min-h-0 min-w-0 flex-1">
        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col rounded-3xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] shadow-[var(--shadow-lg)]">
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden [overflow-clip-margin:24px]">
            {children}
          </div>
        </section>
      </div>
      <ContextDrawer open={contextOpen} onOpenChange={onContextOpenChange} desktopContentClassName="px-4 py-5">
        {context}
      </ContextDrawer>
    </div>
  );
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
  const isContextAvailable = Boolean(context);
  const {
    canPersistPreferences,
    contextDrawerOpen,
    setContextOpen,
    desktopListVisible,
    mobileListOpen,
    setMobileListOpen,
    headerListButtonLabel,
    handleToggleListVisibility,
    handleToggleContext,
    shouldRenderSplitLayout,
    isDesktop,
  } = useInboxLayoutState({
    defaultContextOpen,
    contextAvailable: isContextAvailable,
    currentUser,
  });

  const listContent = useMemo(
    () => <ListPanel sidebar={sidebar} canPersistPreferences={canPersistPreferences} />,
    [sidebar, canPersistPreferences],
  );

  const mobileListContent = useMemo(
    () => <ListPanel sidebar={sidebar} canPersistPreferences={canPersistPreferences} showCloseButton />,
    [sidebar, canPersistPreferences],
  );

  const detailSurface = (
    <DetailSurface context={context} contextOpen={contextDrawerOpen} onContextOpenChange={setContextOpen}>
      {children}
    </DetailSurface>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-surface-shell text-foreground">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="sticky top-0 z-40 flex flex-col border-b border-[color:var(--border-shell)] bg-surface-toolbar/95 backdrop-blur-xl supports-[backdrop-filter]:bg-surface-toolbar">
          <header className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5">
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
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{title}</h1>
                {!contextDrawerOpen ? (
                  <p className="mt-0.5 hidden text-xs text-[color:var(--text-shell-muted)] sm:block">
                    Foco total nas conversas com clientes.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-nowrap sm:gap-3">
              {toolbar ? (
                <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
                  {toolbar}
                </div>
              ) : null}
              <DesktopToolbar
                onToggleListVisibility={handleToggleListVisibility}
                onToggleContext={handleToggleContext}
                contextOpen={contextDrawerOpen}
                desktopListVisible={desktopListVisible}
                headerListButtonLabel={headerListButtonLabel}
                showContextToggle={isContextAvailable}
              />
            </div>
          </header>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="mx-auto flex h-full w-full max-w-7xl flex-1 min-h-0 overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6">
            {shouldRenderSplitLayout ? (
              <SplitLayout
                className="h-full min-h-0 w-full gap-4 sm:gap-6"
                list={listContent}
                detail={detailSurface}
                listClassName={cn(
                  'flex min-h-0 min-w-0 flex-col rounded-3xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] shadow-[var(--shadow-lg)] w-[360px] min-w-[360px] max-w-[360px] flex-shrink-0',
                )}
                detailClassName="flex min-h-0 min-w-0 flex-col"
                listWidth={360}
                isListVisible={Boolean(sidebar) && (isDesktop ? desktopListVisible : true)}
                minListWidth={360}
                maxListWidthPx={360}
                maxListWidthToken="360px"
                resizable={false}
              />
            ) : (
              <div className="flex h-full w-full">{detailSurface}</div>
            )}
          </div>
        </div>
      </div>
      <Sheet open={mobileListOpen} onOpenChange={setMobileListOpen}>
        <SheetContent
          side="left"
          className={cn(
            'w-[min(420px,90vw)] border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-0 text-foreground shadow-[var(--shadow-lg)]',
            'border-r',
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
