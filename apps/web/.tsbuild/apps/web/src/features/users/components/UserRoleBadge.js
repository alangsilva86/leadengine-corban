import { jsx as _jsx } from "react/jsx-runtime";
import { Badge } from '@/components/ui/badge.jsx';
const roleMap = {
    ADMIN: { label: 'Administrador', variant: 'default' },
    SUPERVISOR: { label: 'Supervisor', variant: 'secondary' },
    AGENT: { label: 'Agente', variant: 'outline' },
};
const UserRoleBadge = ({ role }) => {
    const entry = roleMap[role];
    return _jsx(Badge, { variant: entry?.variant ?? 'secondary', children: entry?.label ?? role });
};
export default UserRoleBadge;
