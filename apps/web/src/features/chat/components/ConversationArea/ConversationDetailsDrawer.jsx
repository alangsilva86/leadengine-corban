import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';
import { cn } from '@/lib/utils.js';

/** Painel do contato como folha sobreposta (telas abaixo de 1440px). */
const ConversationDetailsDrawer = ({
  open,
  onOpenChange,
  title = 'Detalhes do contato',
  description = null,
  children,
  className,
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="right"
      {...(!description ? { 'aria-describedby': undefined } : {})}
      className={cn('w-full gap-0 border-l border-border bg-surface p-0 sm:max-w-sm', className)}
    >
      <SheetHeader className="border-b border-border px-4 py-3.5">
        <SheetTitle className="pr-8 text-sm font-semibold text-foreground">{title}</SheetTitle>
        {description ? <SheetDescription>{description}</SheetDescription> : null}
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </SheetContent>
  </Sheet>
);

export default ConversationDetailsDrawer;
