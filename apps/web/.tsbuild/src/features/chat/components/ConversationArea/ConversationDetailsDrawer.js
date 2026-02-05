import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { cn } from '@/lib/utils.js';
const ConversationDetailsDrawer = ({ open, onOpenChange, title = 'Detalhes do atendimento', description = null, children, className, }) => (_jsx(Sheet, { open: open, onOpenChange: onOpenChange, children: _jsxs(SheetContent, { side: "right", className: cn('border-l border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-strong)] p-0 sm:max-w-md', className), children: [_jsxs(SheetHeader, { className: "px-6 py-5", children: [_jsx(SheetTitle, { className: "text-base font-semibold text-[color:var(--color-inbox-foreground)]", children: title }), description ? (_jsx("p", { className: "text-sm text-[color:var(--color-inbox-muted)]", children: description })) : null] }), _jsx(Separator, { className: "border-[color:var(--color-inbox-border)]" }), _jsx(ScrollArea, { className: "h-full max-h-full px-6 py-6", children: _jsx("div", { className: "space-y-6", children: children }) })] }) }));
export default ConversationDetailsDrawer;
