import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Calendar, Download, Filter, TrendingUp, Users, MessageSquare, Target } from 'lucide-react';

const Reports = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);

  // Dados simulados para demonstração
  const leadsData = [
    { name: 'Seg', leads: 45, conversoes: 12 },
    { name: 'Ter', leads: 52, conversoes: 15 },
    { name: 'Qua', leads: 38, conversoes: 8 },
    { name: 'Qui', leads: 61, conversoes: 18 },
    { name: 'Sex', leads: 55, conversoes: 14 },
    { name: 'Sáb', leads: 28, conversoes: 6 },
    { name: 'Dom', leads: 22, conversoes: 4 },
  ];

  const conveniosData = [
    { name: 'SAEC Goiânia', value: 45, color: '#8884d8' },
    { name: 'RF1 Boa Vista', value: 30, color: '#82ca9d' },
    { name: 'EConsig Londrina', value: 15, color: '#ffc658' },
    { name: 'SAEC Curaçá', value: 10, color: '#ff7300' },
  ];

  const performanceData = [
    { metric: 'Taxa de Conversão', value: '12.5%', change: '+2.1%', trend: 'up' },
    { metric: 'Tempo Médio de Resposta', value: '2.3 min', change: '-0.5 min', trend: 'up' },
    { metric: 'Leads Qualificados', value: '89%', change: '+5.2%', trend: 'up' },
    { metric: 'Satisfação do Cliente', value: '4.8/5', change: '+0.2', trend: 'up' },
  ];

  useEffect(() => {
    // Simular carregamento de dados
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [timeRange]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Relatórios e Insights</h1>
          <div className="animate-pulse bg-gray-200 h-10 w-32 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 h-32 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios e Insights</h1>
          <p className="text-gray-600 mt-1">Acompanhe o desempenho dos seus leads e campanhas</p>
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

      {/* Filtros de Tempo */}
      <div className="flex gap-2">
        {[
          { key: '7d', label: '7 dias' },
          { key: '30d', label: '30 dias' },
          { key: '90d', label: '90 dias' },
          { key: 'custom', label: 'Personalizado' },
        ].map((option) => (
          <Button
            key={option.key}
            variant={timeRange === option.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(option.key)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {performanceData.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.metric}</CardTitle>
              <TrendingUp className={`h-4 w-4 ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className={`text-xs ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {metric.change} em relação ao período anterior
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Leads por Dia */}
        <Card>
          <CardHeader>
            <CardTitle>Leads e Conversões por Dia</CardTitle>
            <CardDescription>Últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={leadsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="leads" fill="#8884d8" name="Leads" />
                <Bar dataKey="conversoes" fill="#82ca9d" name="Conversões" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Distribuição por Convênio */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Convênio</CardTitle>
            <CardDescription>Leads por fonte</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={conveniosData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {conveniosData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Detalhes */}
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
                <tr className="border-b">
                  <td className="p-2 font-medium">SAEC Goiânia</td>
                  <td className="text-right p-2">156</td>
                  <td className="text-right p-2">23</td>
                  <td className="text-right p-2 text-green-600">14.7%</td>
                  <td className="text-right p-2">R$ 34.500</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">RF1 Boa Vista</td>
                  <td className="text-right p-2">98</td>
                  <td className="text-right p-2">12</td>
                  <td className="text-right p-2 text-green-600">12.2%</td>
                  <td className="text-right p-2">R$ 18.000</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">EConsig Londrina</td>
                  <td className="text-right p-2">67</td>
                  <td className="text-right p-2">8</td>
                  <td className="text-right p-2 text-yellow-600">11.9%</td>
                  <td className="text-right p-2">R$ 12.000</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium">SAEC Curaçá</td>
                  <td className="text-right p-2">45</td>
                  <td className="text-right p-2">4</td>
                  <td className="text-right p-2 text-red-600">8.9%</td>
                  <td className="text-right p-2">R$ 6.000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
