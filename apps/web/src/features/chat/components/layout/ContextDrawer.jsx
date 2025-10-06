import { useMemo } from 'react';
import { cn } from '@/lib/utils.js';
import { useIsMobile } from '@/hooks/use-mobile.js';
import { Drawer, DrawerContent } from '@/components/ui/drawer.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';

const ContextDrawer = ({ open, onOpenChange, children }) => {
  const isMobile = useIsMobile();

  const content = useMemo(
    () => (
      <ScrollArea className="h-full">
        <div className="min-h-full px-4 py-6 sm:px-5">{children}</div>
      </ScrollArea>
    ),
    [children]
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent side="right" className="border-slate-900/80 bg-slate-950 text-slate-100">
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <aside
      className={cn(
        'relative hidden h-full flex-col border-l border-slate-900/70 bg-slate-950/80 transition-all duration-200 ease-linear lg:flex',
        open ? 'w-[360px] opacity-100' : 'w-0 opacity-0'
      )}
    >
      <div className="pointer-events-auto h-full overflow-hidden">
        {open ? content : null}
      </div>
    </aside>
  );
};

export default ContextDrawer;
