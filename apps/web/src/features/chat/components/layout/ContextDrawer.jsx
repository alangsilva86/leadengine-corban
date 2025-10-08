import { useMemo } from 'react';
import { cn } from '@/lib/utils.js';
import { useIsMobile } from '@/hooks/use-mobile.js';
import { Drawer, DrawerContent } from '@/components/ui/drawer.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';

const ContextDrawer = ({ open, onOpenChange, children, desktopClassName, desktopContentClassName }) => {
  const isMobile = useIsMobile();

  const content = useMemo(
    () => (
      <ScrollArea className="h-full">
        <div className={cn('min-h-full px-4 py-6 sm:px-5', desktopContentClassName)}>{children}</div>
      </ScrollArea>
    ),
    [children, desktopContentClassName]
  );

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

  return (
    <aside
      className={cn(
        'relative hidden h-full min-w-0 flex-col transition-all duration-200 ease-linear lg:flex',
        desktopClassName,
        open ? 'w-[360px] opacity-100' : 'pointer-events-none w-0 opacity-0'
      )}
    >
      <div className="pointer-events-auto h-full overflow-hidden">
        {open ? content : null}
      </div>
    </aside>
  );
};

export default ContextDrawer;
