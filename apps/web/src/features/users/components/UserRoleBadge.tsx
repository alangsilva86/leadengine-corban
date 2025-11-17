import { Badge } from '@/components/ui/badge.jsx';
import type { UserRole } from '../types';

const roleMap: Record<UserRole, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  ADMIN: { label: 'Administrador', variant: 'default' },
  SUPERVISOR: { label: 'Supervisor', variant: 'secondary' },
  AGENT: { label: 'Agente', variant: 'outline' },
};

type UserRoleBadgeProps = {
  role: UserRole;
};

const UserRoleBadge = ({ role }: UserRoleBadgeProps) => {
  const entry = roleMap[role];
  return <Badge variant={entry?.variant ?? 'secondary'}>{entry?.label ?? role}</Badge>;
};

export default UserRoleBadge;
