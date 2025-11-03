import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { cn } from '@/lib/utils.js';

const ConversationDetailsDrawer = ({
  open,
  onOpenChange,
  title = 'Detalhes do atendimento',
  description = null,
  children,
  className,
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="right"
      className={cn(
        'border-l border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-strong)] p-0 sm:max-w-md',
        className,
      )}
    >
      <SheetHeader className="px-6 py-5">
        <SheetTitle className="text-base font-semibold text-[color:var(--color-inbox-foreground)]">
          {title}
        </SheetTitle>
        {description ? (
          <p className="text-sm text-[color:var(--color-inbox-muted)]">{description}</p>
        ) : null}
      </SheetHeader>
      <Separator className="border-[color:var(--color-inbox-border)]" />
      <ScrollArea className="h-full max-h-full px-6 py-6">
        <div className="space-y-6">{children}</div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
);

export default ConversationDetailsDrawer;
