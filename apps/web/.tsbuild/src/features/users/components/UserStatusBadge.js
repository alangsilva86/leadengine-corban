import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Badge } from '@/components/ui/badge.jsx';
const UserStatusBadge = ({ isActive }) => (_jsxs(Badge, { variant: isActive ? 'default' : 'secondary', className: "inline-flex items-center gap-1", children: [_jsx("span", { className: `h-2 w-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground/60'}` }), isActive ? 'Ativo' : 'Inativo'] }));
export default UserStatusBadge;
