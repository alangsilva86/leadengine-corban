import { useEffect, useMemo, useRef } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import ConnectionBanner from './ConnectionBanner.jsx';
import { InboxLayoutContext } from './InboxLayoutContext.js';
import useInboxLayoutState from './hooks/useInboxLayoutState.js';
import { createScrollMemory, LIST_SCROLL_STORAGE_KEY } from './preferences.ts';

const listScrollMemory = createScrollMemory(LIST_SCROLL_STORAGE_KEY);

const ListPane = ({ toolbar, sidebar, className }) => {
  const viewportRef = useRef(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;

    const saved = listScrollMemory.read();
    if (typeof saved === 'number' && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        element.scrollTop = saved;
      });
    }

    const handleScroll = () => listScrollMemory.write(element.scrollTop);
    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      listScrollMemory.write(element.scrollTop);
      element.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <aside
      aria-label="Conversas"
      data-pane="sidebar"
      className={cn('flex h-full min-h-0 min-w-0 flex-col bg-surface', className)}
    >
      {toolbar ? <div className="shrink-0 border-b border-border">{toolbar}</div> : null}
      <div
        ref={viewportRef}
        id="listViewport"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {sidebar}
      </div>
    </aside>
  );
};

/**
 * Estrutura do Inbox: painéis de altura total separados por 1px.
 * - ≥1440px: lista (340px) | conversa | painel do contato (dentro da conversa)
 * - 1024–1439px: lista (320px) | conversa (painel do contato em folha)
 * - <1024px: uma tela por vez — lista primeiro; a conversa tem "Voltar".
 */
const InboxAppShell = ({
  sidebar,
  children,
  toolbar,
  currentUser,
  hasSelection = false,
  onBackToList,
  connection = null,
}) => {
  const layout = useInboxLayoutState({ currentUser, contextAvailable: true });
  const { isTablet, isDesktop, desktopListVisible, handleToggleListVisibility } = layout;

  const contextValue = useMemo(
    () => ({
      ...layout,
      isMobile: !isTablet,
      onBackToList: !isTablet ? onBackToList : undefined,
    }),
    [isTablet, layout, onBackToList],
  );

  const showListOnMobile = !hasSelection;
  const showList = isTablet ? desktopListVisible : showListOnMobile;
  const showDetail = isTablet ? true : !showListOnMobile;

  return (
    <InboxLayoutContext.Provider value={contextValue}>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-background text-foreground">
        <h1 className="sr-only">Inbox</h1>
        {connection ? <ConnectionBanner {...connection} /> : null}
        <div className="flex min-h-0 flex-1">
          {showList ? (
            <ListPane
              toolbar={toolbar}
              sidebar={sidebar}
              className={cn(
                isTablet ? 'w-[320px] shrink-0 border-r border-border min-[1440px]:w-[340px]' : 'w-full',
              )}
            />
          ) : null}
          {isDesktop && !desktopListVisible ? (
            <div className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-surface py-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleToggleListVisibility}
                    aria-label="Mostrar lista de conversas"
                  >
                    <PanelLeftOpen aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Mostrar lista (⌥L)</TooltipContent>
              </Tooltip>
            </div>
          ) : null}
          {showDetail ? (
            <section
              aria-label="Conversa"
              className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background"
            >
              {children}
            </section>
          ) : null}
        </div>
      </div>
    </InboxLayoutContext.Provider>
  );
};

export default InboxAppShell;
