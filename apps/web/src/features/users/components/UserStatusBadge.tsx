import { Badge } from '@/components/ui/badge.jsx';

type UserStatusBadgeProps = {
  isActive: boolean;
};

const UserStatusBadge = ({ isActive }: UserStatusBadgeProps) => (
  <Badge variant={isActive ? 'default' : 'secondary'} className="inline-flex items-center gap-1">
    <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-success' : 'bg-subtle-foreground'}`} />
    {isActive ? 'Ativo' : 'Inativo'}
  </Badge>
);

export default UserStatusBadge;
