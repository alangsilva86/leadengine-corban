import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Download, Filter, TrendingUp } from 'lucide-react';

const TIME_RANGE_OPTIONS = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'custom', label: 'Personalizado' },
];

const LEADS_DATA = [
  { name: 'Seg', leads: 45, conversoes: 12 },
  { name: 'Ter', leads: 52, conversoes: 15 },
  { name: 'Qua', leads: 38, conversoes: 8 },
  { name: 'Qui', leads: 61, conversoes: 18 },
  { name: 'Sex', leads: 55, conversoes: 14 },
  { name: 'Sáb', leads: 28, conversoes: 6 },
  { name: 'Dom', leads: 22, conversoes: 4 },
];

const PERFORMANCE_METRICS = [
  { metric: 'Taxa de Conversão', value: '12.5%', change: '+2.1%', trend: 'up' },
  { metric: 'Tempo Médio de Resposta', value: '2.3 min', change: '-0.5 min', trend: 'up' },
  { metric: 'Leads Qualificados', value: '89%', change: '+5.2%', trend: 'up' },
  { metric: 'Satisfação do Cliente', value: '4.8/5', change: '+0.2', trend: 'up' },
];

const CONVENIO_RATE_STYLES = {
  good: 'textSuccess',
  warning: 'text-yellow-600',
  bad: 'textStatusError',
};

const CONVENIO_DATA = [
  {
    name: 'SAEC Goiânia',
    chartValue: 45,
    color: 'var(--color-chart-1)',
    leads: 156,
    conversions: 23,
    conversionRate: 0.147,
    revenue: 34500,
    rateLevel: 'good',
  },
  {
    name: 'RF1 Boa Vista',
    chartValue: 30,
    color: 'var(--color-chart-2)',
    leads: 98,
    conversions: 12,
    conversionRate: 0.122,
    revenue: 18000,
    rateLevel: 'good',
  },
  {
    name: 'EConsig Londrina',
    chartValue: 15,
    color: 'var(--color-chart-3)',
    leads: 67,
    conversions: 8,
    conversionRate: 0.119,
    revenue: 12000,
    rateLevel: 'warning',
  },
  {
    name: 'SAEC Curaçá',
    chartValue: 10,
    color: 'var(--color-chart-4)',
    leads: 45,
    conversions: 4,
    conversionRate: 0.089,
    revenue: 6000,
    rateLevel: 'bad',
  },
];

const formatCurrency = (value) => `R$ ${value.toLocaleString('pt-BR')}`;

const formatPercentage = (value) => `${(value * 100).toFixed(1)}%`;

const getConvenioRateClass = (rateLevel) => CONVENIO_RATE_STYLES[rateLevel] ?? CONVENIO_RATE_STYLES.good;

const getConvenioChartData = (items) =>
  items.map(({ name, chartValue, color }) => ({ name, value: chartValue, color }));

const CONVENIO_CHART_DATA = getConvenioChartData(CONVENIO_DATA);

const LoadingSkeleton = () => (
  <div className="p-6 space-y-6">
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold">Relatórios e Insights</h1>
      <div className="animate-pulse bgSurfaceOverlayQuiet h-10 w-32 rounded"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="animate-pulse bgSurfaceOverlayQuiet h-32 rounded-lg"></div>
      ))}
    </div>
  </div>
);

const ReportsHeader = () => (
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-3xl font-bold">Relatórios e Insights</h1>
      <p className="textForegroundMuted mt-1">Acompanhe o desempenho dos seus leads e campanhas</p>
    </div>
    <div className="flex gap-2">
      <Button variant="outline" size="sm">
        <Filter className="w-4 h-4 mr-2" />
        Filtros
      </Button>
      <Button variant="outline" size="sm">
        <Download className="w-4 h-4 mr-2" />
        Exportar
      </Button>
    </div>
  </div>
);

const TimeRangeFilters = ({ activeRange, onSelect }) => (
  <div className="flex gap-2">
    {TIME_RANGE_OPTIONS.map((option) => (
      <Button
        key={option.key}
        variant={activeRange === option.key ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSelect(option.key)}
      >
        {option.label}
      </Button>
    ))}
  </div>
);

const PerformanceMetricCard = ({ metric }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{metric.metric}</CardTitle>
      <TrendingUp className={`h-4 w-4 ${metric.trend === 'up' ? 'textSuccess' : 'textStatusError'}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{metric.value}</div>
      <p className={`text-xs ${metric.trend === 'up' ? 'textSuccess' : 'textStatusError'}`}>
        {metric.change} em relação ao período anterior
      </p>
    </CardContent>
  </Card>
);

const PerformanceMetricsSection = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {PERFORMANCE_METRICS.map((metric) => (
      <PerformanceMetricCard key={metric.metric} metric={metric} />
    ))}
  </div>
);

const LeadsBarChartCard = () => (
  <Card>
    <CardHeader>
      <CardTitle>Leads e Conversões por Dia</CardTitle>
      <CardDescription>Últimos 7 dias</CardDescription>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={LEADS_DATA}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="leads" fill="var(--color-chart-1)" name="Leads" />
          <Bar dataKey="conversoes" fill="var(--color-chart-2)" name="Conversões" />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

const ConvenioDistributionCard = ({ data }) => (
  <Card>
    <CardHeader>
      <CardTitle>Distribuição por Convênio</CardTitle>
      <CardDescription>Leads por fonte</CardDescription>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="var(--color-chart-1)"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

const ConvenioDetailsRow = ({ convenio, isLast }) => (
  <tr className={isLast ? undefined : 'border-b'}>
    <td className="p-2 font-medium">{convenio.name}</td>
    <td className="text-right p-2">{convenio.leads}</td>
    <td className="text-right p-2">{convenio.conversions}</td>
    <td className={`text-right p-2 ${getConvenioRateClass(convenio.rateLevel)}`}>
      {formatPercentage(convenio.conversionRate)}
    </td>
    <td className="text-right p-2">{formatCurrency(convenio.revenue)}</td>
  </tr>
);

const ConvenioDetailsCard = ({ convenios }) => (
  <Card>
    <CardHeader>
      <CardTitle>Detalhamento por Convênio</CardTitle>
      <CardDescription>Performance detalhada dos últimos 7 dias</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Convênio</th>
              <th className="text-right p-2">Leads</th>
              <th className="text-right p-2">Conversões</th>
              <th className="text-right p-2">Taxa</th>
              <th className="text-right p-2">Receita</th>
            </tr>
          </thead>
          <tbody>
            {convenios.map((convenio, index) => (
              <ConvenioDetailsRow
                key={convenio.name}
                convenio={convenio}
                isLast={index === convenios.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
);

const Reports = () => {
  const [timeRange, setTimeRange] = useState(TIME_RANGE_OPTIONS[0].key);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular carregamento de dados
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [timeRange]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      <ReportsHeader />
      <TimeRangeFilters activeRange={timeRange} onSelect={setTimeRange} />
      <PerformanceMetricsSection />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadsBarChartCard />
        <ConvenioDistributionCard data={CONVENIO_CHART_DATA} />
      </div>
      <ConvenioDetailsCard convenios={CONVENIO_DATA} />
    </div>
  );
};

export default Reports;
