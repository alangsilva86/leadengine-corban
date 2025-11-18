import StatusPill from '@/components/ui/status-pill.jsx';

export interface TenantStatusBadgeProps {
  isActive: boolean;
}

const TenantStatusBadge = ({ isActive }: TenantStatusBadgeProps) => {
  return (
    <StatusPill tone={isActive ? 'success' : 'warning'} withDot>
      {isActive ? 'Ativo' : 'Inativo'}
    </StatusPill>
  );
};

export default TenantStatusBadge;
