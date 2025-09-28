import {
  Ticket,
  Users,
  MessageSquare,
  TrendingUp,
  Phone,
  Mail,
  Calendar,
  MoreVertical,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils.js';

const getOnboardingProgress = (onboarding) => {
  if (!onboarding?.stages?.length) {
    return { currentIndex: 0, total: 0, progressValue: 0, displayIndex: 0, nextStage: null, isComplete: false };
  }

  const total = onboarding.stages.length;
  const activeStep = typeof onboarding.activeStep === 'number' ? onboarding.activeStep : 0;
  const currentIndex = Math.min(activeStep, total - 1);
  const displayIndex = Math.min(activeStep + 1, total);
  const progressValue = Math.round((displayIndex / total) * 100);
  const hasCampaign = Boolean(onboarding.activeCampaign);
  const isComplete = hasCampaign && currentIndex >= total - 1;
  const nextIndex = Math.min(currentIndex + 1, total - 1);
  const nextStage = isComplete
    ? 'Atenda seus leads na Inbox'
    : onboarding.stages[nextIndex]?.label ?? onboarding.stages[currentIndex]?.label;

  return { currentIndex, total, progressValue, displayIndex, nextStage, isComplete };
};

const statIconStyles = {
  blue: 'bg-blue-500/15 text-blue-300',
  green: 'bg-emerald-500/15 text-emerald-300',
  purple: 'bg-purple-500/15 text-purple-300',
  orange: 'bg-amber-500/15 text-amber-300',
};

const Dashboard = ({ onboarding, onStart }) => {
  // Dados mockados para demonstração
  const stats = [
    {
      title: 'Tickets Ativos',
      value: '247',
      change: '+12%',
      trend: 'up',
      icon: Ticket,
      color: 'blue'
    },
    {
      title: 'Leads Novos',
      value: '89',
      change: '+8%',
      trend: 'up',
      icon: Users,
      color: 'green'
    },
    {
      title: 'Mensagens Hoje',
      value: '1,234',
      change: '+23%',
      trend: 'up',
      icon: MessageSquare,
      color: 'purple'
    },
    {
      title: 'Taxa de Conversão',
      value: '12.5%',
      change: '+2.1%',
      trend: 'up',
      icon: TrendingUp,
      color: 'orange'
    }
  ];

  const ticketsData = [
    { name: 'Seg', abertos: 45, fechados: 38, pendentes: 12 },
    { name: 'Ter', abertos: 52, fechados: 41, pendentes: 15 },
    { name: 'Qua', abertos: 38, fechados: 45, pendentes: 8 },
    { name: 'Qui', abertos: 61, fechados: 52, pendentes: 18 },
    { name: 'Sex', abertos: 55, fechados: 48, pendentes: 14 },
    { name: 'Sáb', abertos: 28, fechados: 32, pendentes: 6 },
    { name: 'Dom', abertos: 22, fechados: 28, pendentes: 4 }
  ];

  const leadsData = [
    { name: 'Jan', leads: 65, conversoes: 12 },
    { name: 'Fev', leads: 78, conversoes: 15 },
    { name: 'Mar', leads: 92, conversoes: 18 },
    { name: 'Abr', leads: 85, conversoes: 16 },
    { name: 'Mai', leads: 98, conversoes: 22 },
    { name: 'Jun', leads: 112, conversoes: 28 }
  ];

  const channelData = [
    { name: 'WhatsApp', value: 45, color: '#25D366' },
    { name: 'Email', value: 25, color: '#EA4335' },
    { name: 'Telefone', value: 20, color: '#4285F4' },
    { name: 'Chat', value: 10, color: '#9333EA' }
  ];

  const recentTickets = [
    {
      id: '#TK-001',
      customer: 'Maria Silva',
      subject: 'Problema com login',
      status: 'open',
      priority: 'high',
      channel: 'whatsapp',
      time: '2 min atrás'
    },
    {
      id: '#TK-002',
      customer: 'João Santos',
      subject: 'Dúvida sobre produto',
      status: 'pending',
      priority: 'medium',
      channel: 'email',
      time: '15 min atrás'
    },
    {
      id: '#TK-003',
      customer: 'Ana Costa',
      subject: 'Solicitação de reembolso',
      status: 'resolved',
      priority: 'low',
      channel: 'phone',
      time: '1 hora atrás'
    },
    {
      id: '#TK-004',
      customer: 'Pedro Lima',
      subject: 'Configuração de conta',
      status: 'open',
      priority: 'medium',
      channel: 'chat',
      time: '2 horas atrás'
    }
  ];

  const getStatusBadge = (status) => {
    const variants = {
      open: 'destructive',
      pending: 'secondary',
      resolved: 'default'
    };
    return variants[status] || 'secondary';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'text-red-500',
      medium: 'text-yellow-500',
      low: 'text-green-500'
    };
    return colors[priority] || 'text-gray-500';
  };

  const getChannelIcon = (channel) => {
    const icons = {
      whatsapp: MessageSquare,
      email: Mail,
      phone: Phone,
      chat: MessageSquare
    };
    const Icon = icons[channel] || MessageSquare;
    return <Icon className="h-4 w-4" />;
  };

  const heroStyle = {
    background:
      'radial-gradient(circle at top left, rgba(99,102,241,0.2), transparent 55%), radial-gradient(circle at bottom right, rgba(34,197,94,0.15), transparent 60%), rgba(15,23,42,0.65)',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.45)',
  };

  const { total, progressValue, displayIndex, nextStage, isComplete } = getOnboardingProgress(onboarding);
  const stageLabel = nextStage || 'Conclua as etapas';
  const hasStarted = Boolean(onboarding?.selectedAgreement || onboarding?.whatsappStatus !== 'disconnected');
  const primaryCtaLabel = hasStarted ? 'Continuar configuração' : 'Ativar meu primeiro convênio';

  return (
    <div className="space-y-6">
      <div
        className="grid gap-6 rounded-[24px] border border-[rgba(99,102,241,0.2)] p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        style={heroStyle}
      >
        <div className="grid max-w-xl gap-4">
          <h1 className="text-3xl font-semibold text-foreground">Mudamos a forma de gerar demanda</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Conecte um convênio, sincronize seu WhatsApp e receba apenas leads que já levantaram a mão. Acompanhe tudo em
            tempo real neste painel.
          </p>
          {total ? (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[rgba(226,232,240,0.72)]">
                <span>Primeira configuração</span>
                <span>
                  {displayIndex} de {total}
                </span>
              </div>
              <Progress value={progressValue} className="h-2" />
              <p className="text-xs text-slate-300">
                {isComplete ? 'Tudo pronto:' : 'Próximo passo:'}{' '}
                <span className="font-medium text-foreground">{stageLabel}</span>
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onStart}>
              <Sparkles className="h-4 w-4" />
              {primaryCtaLabel}
            </Button>
            <Button variant="outline" size="lg">
              <Calendar className="h-4 w-4" />
              Relatório da semana
            </Button>
          </div>
        </div>
        {onboarding?.stages ? (
          <div className="grid min-w-[220px] gap-3 rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.5)] p-4">
            {onboarding.stages.map((stage, index) => {
              const status =
                index < onboarding.activeStep
                  ? 'done'
                  : index === onboarding.activeStep
                  ? 'current'
                  : 'todo';
              const statusClasses = {
                done: 'border-emerald-500/40 bg-emerald-500/20',
                current: 'border-[rgba(99,102,241,0.4)] bg-[rgba(99,102,241,0.16)]',
                todo: 'border-white/5 bg-white/5',
              };
              const indexClasses = {
                done: 'bg-emerald-500 text-[#022c17] border-transparent',
                current: 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent',
                todo: 'bg-white/10 text-[var(--text-muted)] border-white/20',
              };
              return (
                <div
                  key={stage.id}
                  className={cn(
                    'grid grid-cols-[auto,1fr] items-center gap-3 rounded-lg border p-3 text-sm transition-colors',
                    statusClasses[status]
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                      indexClasses[status]
                    )}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <span className="block font-medium text-foreground">{stage.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {status === 'done' ? 'Concluído' : status === 'current' ? 'Próxima etapa' : 'Aguardando'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} className="transition-shadow duration-200 hover:shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div className={cn('flex items-center justify-center rounded-lg p-2', statIconStyles[stat.color])}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-300">
                  {stat.change}
                </Badge>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-semibold text-foreground">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tickets Chart */}
        <Card className="transition-shadow duration-200 hover:shadow-lg">
          <CardHeader>
            <CardTitle>Tickets por Dia</CardTitle>
            <CardDescription>
              Acompanhe o volume de tickets abertos, fechados e pendentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ticketsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="abertos" fill="#ef4444" name="Abertos" />
                <Bar dataKey="fechados" fill="#22c55e" name="Fechados" />
                <Bar dataKey="pendentes" fill="#f59e0b" name="Pendentes" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leads Chart */}
        <Card className="transition-shadow duration-200 hover:shadow-lg">
          <CardHeader>
            <CardTitle>Leads e Conversões</CardTitle>
            <CardDescription>
              Evolução mensal de leads e taxa de conversão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={leadsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="leads" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Leads"
                />
                <Line 
                  type="monotone" 
                  dataKey="conversoes" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Conversões"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Channel Distribution */}
        <Card className="transition-shadow duration-200 hover:shadow-lg lg:col-span-1">
          <CardHeader>
            <CardTitle>Canais de Atendimento</CardTitle>
            <CardDescription>
              Distribuição de tickets por canal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {channelData.map((channel, index) => (
                <div key={index} className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: channel.color }}
                    />
                    <span className="text-foreground">{channel.name}</span>
                  </div>
                  <span className="font-medium">{channel.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Tickets */}
        <Card className="transition-shadow duration-200 hover:shadow-lg lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tickets Recentes</CardTitle>
                <CardDescription>
                  Últimas atividades de atendimento
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTickets.map((ticket, index) => (
                <div
                  key={index}
                  className="flex transform items-start justify-between gap-4 rounded-lg border border-[var(--border)] bg-[rgba(15,23,42,0.35)] p-4 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:bg-[rgba(99,102,241,0.08)]"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{ticket.id}</span>
                      <Badge variant={getStatusBadge(ticket.status)}>
                        {ticket.status}
                      </Badge>
                    </div>
                    <h4 className="text-base font-medium text-foreground">{ticket.customer}</h4>
                    <p className="text-sm text-muted-foreground">{ticket.subject}</p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {getChannelIcon(ticket.channel)}
                        <span className="capitalize">{ticket.channel}</span>
                      </div>
                      <span className={cn('font-medium', getPriorityColor(ticket.priority))}>
                        ● {ticket.priority}
                      </span>
                      <span className="ml-auto text-xs">{ticket.time}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
