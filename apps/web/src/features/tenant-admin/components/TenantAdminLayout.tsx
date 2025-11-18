import { useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout.jsx';
import { NAVIGATION_PAGES } from '@/features/navigation/routes.ts';

interface TenantAdminLayoutProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

const TenantAdminLayout = ({ title, description, children }: TenantAdminLayoutProps) => {
  const navigate = useNavigate();

  const handleNavigate = useCallback(
    (pageId: string) => {
      const definition = NAVIGATION_PAGES[pageId];
      if (definition?.path) {
        navigate(definition.path);
      }
    },
    [navigate]
  );

  return (
    <Layout currentPage={NAVIGATION_PAGES['tenant-admin'].id} onNavigate={handleNavigate} onboarding={null}>
      <div className="space-y-6">
        <div className="space-y-1">
          {title ? <h1 className="text-2xl font-semibold text-foreground">{title}</h1> : null}
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </div>
    </Layout>
  );
};

export default TenantAdminLayout;
