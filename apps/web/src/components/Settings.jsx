import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider.jsx';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import QueuesTab from './settings/QueuesTab.jsx';
import AiSettingsTab from './settings/AiSettingsTab';
import MetaSettingsTab from './settings/MetaSettingsTab';
import UsersSettingsTab from '@/features/users/components/UsersSettingsTab';

const Settings = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const managesWorkspace = isAdmin || user?.role === 'SUPERVISOR';
  return (
    <div className="min-w-0 space-y-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="general">Organização</TabsTrigger>
          {managesWorkspace && <TabsTrigger value="users">Usuários</TabsTrigger>}
          {managesWorkspace && <TabsTrigger value="queues">Filas</TabsTrigger>}
          {isAdmin && <TabsTrigger value="meta">Meta</TabsTrigger>}
          {isAdmin && <TabsTrigger value="ai">IA</TabsTrigger>}
        </TabsList>
        <TabsContent value="general">
          <Card>
            <CardHeader><CardTitle>{user?.tenant?.name ?? 'Organização'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-sm text-muted-foreground">Identificador</dt><dd>{user?.tenant?.slug ?? '—'}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Fuso horário</dt><dd>{user?.tenant?.settings?.timezone ?? 'America/Sao_Paulo'}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Conta</dt><dd className="break-all">{user?.email}</dd></div>
              </dl>
              <Button variant="outline" asChild><Link to="/channels">Consultar canais</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>
        {managesWorkspace && <TabsContent value="users"><UsersSettingsTab currentUserId={user.id} canManage={isAdmin} /></TabsContent>}
        {managesWorkspace && <TabsContent value="queues"><QueuesTab /></TabsContent>}
        {isAdmin && <TabsContent value="meta"><MetaSettingsTab /></TabsContent>}
        {isAdmin && <TabsContent value="ai"><AiSettingsTab /></TabsContent>}
      </Tabs>
    </div>
  );
};

export default Settings;
