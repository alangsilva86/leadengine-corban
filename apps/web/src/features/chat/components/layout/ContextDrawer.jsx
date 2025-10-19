import { useMemo } from 'react';
import { cn } from '@/lib/utils.js';
import { useIsMobile } from '@/hooks/use-mobile.js';
import { Drawer, DrawerContent } from '@/components/ui/drawer.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';

const ContextDrawer = ({ open, onOpenChange, children, desktopClassName, desktopContentClassName }) => {
  const isMobile = useIsMobile();

  const content = useMemo(() => {
    return (
      <ScrollArea className="flex-1 min-h-0" viewportClassName="min-h-0 overscroll-contain">
        <div className={cn('px-4 py-6 sm:px-5', desktopContentClassName)}>{children}</div>
      </ScrollArea>
    );
  }, [children, desktopContentClassName]);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          side="right"
          className={cn('border-[color:var(--border-shell)] bg-surface-shell-muted text-foreground shadow-xl backdrop-blur-xl', desktopClassName)}
        >
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  if (!open) {
    return null;
  }

  return (
    <aside className="hidden h-full min-h-0 flex-shrink-0 lg:flex">
      <div className={cn('flex h-full min-h-0 w-[360px] flex-col overflow-hidden rounded-3xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] shadow-[var(--shadow-lg)]', desktopClassName)}>
        {content}
      </div>
    </aside>
  );
};

export default ContextDrawer;
