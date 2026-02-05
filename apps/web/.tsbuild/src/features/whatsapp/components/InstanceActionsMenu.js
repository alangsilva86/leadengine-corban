import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from '@/components/ui/button.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu.jsx';
import { Loader2, MoreVertical, QrCode, Trash2 } from 'lucide-react';
const InstanceActionsMenu = ({ instance, deletingInstanceId, isBusy, isAuthenticated, onViewQr, onRequestDelete, onRenameInstance, onViewLogs, }) => {
    const isDeleting = deletingInstanceId === instance?.id;
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", "aria-label": "A\u00E7\u00F5es da inst\u00E2ncia", disabled: isDeleting, children: isDeleting ? _jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : _jsx(MoreVertical, { className: "h-4 w-4" }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsx(DropdownMenuItem, { onClick: () => onRenameInstance?.(instance), disabled: isDeleting, children: "Renomear inst\u00E2ncia" }), _jsxs(DropdownMenuItem, { onClick: () => onViewQr?.(instance), disabled: isBusy || !isAuthenticated, children: [_jsx(QrCode, { className: "mr-2 h-4 w-4" }), "Ver QR em tela cheia"] }), _jsx(DropdownMenuItem, { onClick: () => onViewLogs?.(instance), disabled: isBusy, children: "Ver logs da sess\u00E3o" }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { variant: "destructive", onClick: (event) => {
                            event.preventDefault();
                            onRequestDelete?.(instance);
                        }, disabled: isDeleting, children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), "Remover inst\u00E2ncia"] })] })] }));
};
export default InstanceActionsMenu;
