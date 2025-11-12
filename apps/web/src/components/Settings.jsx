import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { 
  Settings as SettingsIcon, 
  Users, 
  Bell, 
  Shield, 
  Database, 
  Webhook,
  Key,
  Mail,
  Phone,
  Globe,
  Save,
  Plus,
  Trash2,
  Edit
} from 'lucide-react';
import QueuesTab from './settings/QueuesTab.jsx';
import AiSettingsTab from './settings/AiSettingsTab';
import MetaSettingsTab from './settings/MetaSettingsTab';

const Settings = () => {
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      sms: false,
      push: true,
      leadAlerts: true,
    },
    integrations: {
      whatsapp: true,
      email: false,
      webhook: false,
    },
    security: {
      twoFactor: false,
      sessionTimeout: 30,
      ipWhitelist: false,
    }
  });

  const [users] = useState([
    { id: 1, name: 'João Silva', email: 'joao@corban.com', role: 'Admin', status: 'Ativo' },
    { id: 2, name: 'Maria Santos', email: 'maria@corban.com', role: 'Agente', status: 'Ativo' },
    { id: 3, name: 'Pedro Costa', email: 'pedro@corban.com', role: 'Supervisor', status: 'Inativo' },
  ]);

  const handleSettingChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const handleSave = () => {
    // Simular salvamento
    alert('Configurações salvas com sucesso!');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="textForegroundMuted mt-1">Gerencie sua conta, equipe e integrações</p>
        </div>
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Salvar Alterações
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="meta">Meta</TabsTrigger>
          <TabsTrigger value="ai">IA</TabsTrigger>
          <TabsTrigger value="security">Segurança</TabsTrigger>
          <TabsTrigger value="queues">Filas</TabsTrigger>
        </TabsList>

        {/* Configurações Gerais */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Empresa</CardTitle>
              <CardDescription>Configure os dados básicos da sua organização</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Nome da Empresa</Label>
                  <Input id="company-name" defaultValue="Corban Correspondente Bancário" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-cnpj">CNPJ</Label>
                  <Input id="company-cnpj" defaultValue="12.345.678/0001-90" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Telefone</Label>
                  <Input id="company-phone" defaultValue="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email">E-mail</Label>
                  <Input id="company-email" defaultValue="contato@corban.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-address">Endereço</Label>
                <Input id="company-address" defaultValue="Rua das Flores, 123 - Centro, São Paulo - SP" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurações do Sistema</CardTitle>
              <CardDescription>Personalize o comportamento da aplicação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuso Horário</Label>
                  <select id="timezone" className="w-full p-2 border rounded-md">
                    <option>America/Sao_Paulo</option>
                    <option>America/Manaus</option>
                    <option>America/Fortaleza</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Idioma</Label>
                  <select id="language" className="w-full p-2 border rounded-md">
                    <option>Português (Brasil)</option>
                    <option>English</option>
                    <option>Español</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <AiSettingsTab />
        </TabsContent>

        <TabsContent value="meta" className="space-y-6">
          <MetaSettingsTab />
        </TabsContent>

        {/* Gerenciamento de Usuários */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Usuários da Equipe</CardTitle>
                <CardDescription>Gerencie os membros da sua equipe e suas permissões</CardDescription>
              </div>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Usuário
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">E-mail</th>
                      <th className="text-left p-2">Função</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-right p-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b">
                        <td className="p-2 font-medium">{user.name}</td>
                        <td className="p-2 textForegroundMuted">{user.email}</td>
                        <td className="p-2">
                          <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <Badge variant={user.status === 'Ativo' ? 'default' : 'secondary'}>
                            {user.status}
                          </Badge>
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>Configure como e quando você quer ser notificado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações por E-mail</Label>
                    <p className="text-sm textForegroundMuted">Receba atualizações importantes por e-mail</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.email}
                    onCheckedChange={(value) => handleSettingChange('notifications', 'email', value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações por SMS</Label>
                    <p className="text-sm textForegroundMuted">Receba alertas urgentes por SMS</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.sms}
                    onCheckedChange={(value) => handleSettingChange('notifications', 'sms', value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações Push</Label>
                    <p className="text-sm textForegroundMuted">Receba notificações no navegador</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.push}
                    onCheckedChange={(value) => handleSettingChange('notifications', 'push', value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Alertas de Novos Leads</Label>
                    <p className="text-sm textForegroundMuted">Seja notificado imediatamente sobre novos leads</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.leadAlerts}
                    onCheckedChange={(value) => handleSettingChange('notifications', 'leadAlerts', value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrações */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integrações Ativas</CardTitle>
              <CardDescription>Gerencie suas conexões com serviços externos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="w-5 h-5 textStatusWhatsapp" />
                      <span className="font-medium">WhatsApp Business</span>
                    </div>
                    <Badge variant="default">Conectado</Badge>
                  </div>
                  <p className="text-sm textForegroundMuted">Receba e envie mensagens via WhatsApp</p>
                  <Button variant="outline" size="sm">Configurar</Button>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">E-mail Marketing</span>
                    </div>
                    <Badge variant="secondary">Desconectado</Badge>
                  </div>
                  <p className="text-sm textForegroundMuted">Integre com plataformas de e-mail marketing</p>
                  <Button variant="outline" size="sm">Conectar</Button>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Webhook className="w-5 h-5 text-purple-600" />
                      <span className="font-medium">Webhooks</span>
                    </div>
                    <Badge variant="secondary">Desconectado</Badge>
                  </div>
                  <p className="text-sm textForegroundMuted">Envie dados para sistemas externos</p>
                  <Button variant="outline" size="sm">Configurar</Button>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-orange-600" />
                      <span className="font-medium">CRM Externo</span>
                    </div>
                    <Badge variant="secondary">Desconectado</Badge>
                  </div>
                  <p className="text-sm textForegroundMuted">Sincronize com seu CRM atual</p>
                  <Button variant="outline" size="sm">Conectar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Segurança */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Segurança</CardTitle>
              <CardDescription>Proteja sua conta e dados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Autenticação de Dois Fatores</Label>
                    <p className="text-sm textForegroundMuted">Adicione uma camada extra de segurança</p>
                  </div>
                  <Switch 
                    checked={settings.security.twoFactor}
                    onCheckedChange={(value) => handleSettingChange('security', 'twoFactor', value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Timeout de Sessão (minutos)</Label>
                  <Input 
                    id="session-timeout" 
                    type="number" 
                    value={settings.security.sessionTimeout}
                    onChange={(e) => handleSettingChange('security', 'sessionTimeout', parseInt(e.target.value))}
                    className="w-32"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Lista Branca de IPs</Label>
                    <p className="text-sm textForegroundMuted">Restrinja acesso a IPs específicos</p>
                  </div>
                  <Switch 
                    checked={settings.security.ipWhitelist}
                    onCheckedChange={(value) => handleSettingChange('security', 'ipWhitelist', value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chaves de API</CardTitle>
              <CardDescription>Gerencie suas chaves de acesso à API</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Chave Principal</p>
                    <p className="text-sm textForegroundMuted">tk_live_••••••••••••••••</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Regenerar</Button>
                    <Button variant="outline" size="sm">Copiar</Button>
                  </div>
                </div>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Chave de API
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues" className="space-y-6">
          <QueuesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
