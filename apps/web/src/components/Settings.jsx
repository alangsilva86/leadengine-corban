import { Suspense, lazy, useMemo } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { Bot, Building2, ListOrdered, Megaphone, Stethoscope, Users } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider.jsx';
import { PageHeader } from '@/components/page/PageHeader.jsx';
import { PageSkeleton } from '@/components/page/PageSkeleton.jsx';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { cn } from '@/lib/utils.js';
import { isDiagnosticsEnabled } from '@/lib/features.js';
import QueuesTab from './settings/QueuesTab.jsx';
import AiSettingsTab from './settings/AiSettingsTab';
import MetaSettingsTab from './settings/MetaSettingsTab';
import UsersSettingsTab from '@/features/users/components/UsersSettingsTab';

const DiagnosticsTab = lazy(() => import('@/features/debug/BaileysLogs.jsx'));

const CompanyTab = ({ user }) => (
  <Card>
    <CardHeader>
      <CardTitle>{user?.tenant?.name ?? 'Sua empresa'}</CardTitle>
      <CardDescription>Dados da conta usados em todo o Lead Engine.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Código da empresa</dt>
          <dd className="font-mono text-sm text-foreground">{user?.tenant?.slug ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Fuso horário</dt>
          <dd className="text-sm text-foreground">{user?.tenant?.settings?.timezone ?? 'America/Sao_Paulo'}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Seu acesso</dt>
          <dd className="break-all text-sm text-foreground">{user?.email}</dd>
        </div>
      </dl>
      <Button variant="outline" asChild>
        <Link to="/channels">Ver números de WhatsApp</Link>
      </Button>
    </CardContent>
  </Card>
);

/**
 * Configurações com uma URL por seção (/settings/users, /settings/queues…),
 * para que dê para compartilhar o link direto e usar o botão voltar.
 */
const Settings = () => {
  const { user } = useAuth();
  const { section } = useParams();
  const isAdmin = user?.role === 'ADMIN';
  const managesWorkspace = isAdmin || user?.role === 'SUPERVISOR';

  const sections = useMemo(
    () =>
      [
        { id: 'company', label: 'Empresa', icon: Building2, visible: true, render: () => <CompanyTab user={user} /> },
        {
          id: 'users',
          label: 'Equipe',
          icon: Users,
          visible: managesWorkspace,
          render: () => <UsersSettingsTab currentUserId={user.id} canManage={isAdmin} />,
        },
        { id: 'queues', label: 'Filas', icon: ListOrdered, visible: managesWorkspace, render: () => <QueuesTab /> },
        { id: 'ai', label: 'IA', icon: Bot, visible: isAdmin, render: () => <AiSettingsTab /> },
        { id: 'integrations', label: 'Meta Ads', icon: Megaphone, visible: isAdmin, render: () => <MetaSettingsTab /> },
        {
          id: 'diagnostics',
          label: 'Diagnóstico',
          icon: Stethoscope,
          visible: isAdmin && isDiagnosticsEnabled(),
          render: () => (
            <Suspense fallback={<PageSkeleton />}>
              <DiagnosticsTab />
            </Suspense>
          ),
        },
      ].filter((item) => item.visible),
    [isAdmin, managesWorkspace, user],
  );

  if (!section) {
    return <Navigate to="/settings/company" replace />;
  }

  const active = sections.find((item) => item.id === section);
  if (!active) {
    return <Navigate to="/settings/company" replace />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Configurações"
        documentTitle={`${active.label} · Configurações`}
        description="Empresa, equipe, filas de atendimento e integrações."
      />
      <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start">
        <nav aria-label="Seções de configurações" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:w-52 lg:shrink-0 lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {sections.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={`/settings/${item.id}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'bg-primary-soft text-primary-soft-foreground'
                        : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-label={active.label} className="min-w-0 flex-1">
          {active.render()}
        </section>
      </div>
    </div>
  );
};

export default Settings;
