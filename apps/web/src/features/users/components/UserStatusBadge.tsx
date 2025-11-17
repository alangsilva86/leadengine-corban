import { Badge } from '@/components/ui/badge.jsx';

type UserStatusBadgeProps = {
  isActive: boolean;
};

const UserStatusBadge = ({ isActive }: UserStatusBadgeProps) => (
  <Badge variant={isActive ? 'default' : 'secondary'} className="inline-flex items-center gap-1">
    <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground/60'}`} />
    {isActive ? 'Ativo' : 'Inativo'}
  </Badge>
);

export default UserStatusBadge;
