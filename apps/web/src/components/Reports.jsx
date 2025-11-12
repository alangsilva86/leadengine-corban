import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Download } from 'lucide-react';

import { apiGet } from '@/lib/api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const TIME_RANGE_OPTIONS = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
];

const DIMENSION_OPTIONS = [
  { key: 'agreement', label: 'Convênio' },
  { key: 'campaign', label: 'Campanha' },
  { key: 'instance', label: 'Instância' },
  { key: 'product', label: 'Produto' },
  { key: 'strategy', label: 'Estratégia' },
];

const RANGE_IN_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
];

const EMPTY_METRICS = {
  total: 0,
  allocated: 0,
  contacted: 0,
  won: 0,
  lost: 0,
  averageResponseSeconds: null,
  conversionRate: 0,
};

const numberFormatter = new Intl.NumberFormat('pt-BR');
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampRatio = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 1) {
    return 1;
  }
  return Number(parsed.toFixed(4));
};

const parseMetricsSnapshot = (input) => {
  if (!input || typeof input !== 'object') {
    return { ...EMPTY_METRICS };
  }

  const total = safeNumber(input.total);
  const allocated = safeNumber(input.allocated);
  const contacted = safeNumber(input.contacted);
  const won = safeNumber(input.won);
  const lost = safeNumber(input.lost);
  const averageSecondsRaw = Number(input.averageResponseSeconds);
  const averageResponseSeconds = Number.isFinite(averageSecondsRaw) ? Math.max(0, Math.round(averageSecondsRaw)) : null;
  const conversionRate = clampRatio(input.conversionRate);

  return {
    total,
    allocated,
    contacted,
    won,
    lost,
    averageResponseSeconds,
    conversionRate,
  };
};

const parseBreakdown = (entries) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const date = typeof entry.date === 'string' ? entry.date : null;
      if (!date) {
        return null;
      }
      return {
        date,
        metrics: parseMetricsSnapshot(entry.metrics),
      };
    })
    .filter(Boolean);
};

const parseGroup = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const keyCandidate = typeof entry.key === 'string' && entry.key.trim().length > 0 ? entry.key.trim() : null;
  const label = typeof entry.label === 'string' && entry.label.trim().length > 0 ? entry.label.trim() : keyCandidate ?? 'Segmento';
  const key = keyCandidate ?? label;
  const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
  const dimension = typeof entry.dimension === 'string' ? entry.dimension : '';

  return {
    key,
    label,
    dimension,
    metadata,
    metrics: parseMetricsSnapshot(entry.metrics),
    breakdown: parseBreakdown(entry.breakdown),
  };
};

const computeRange = (rangeKey) => {
  const days = RANGE_IN_DAYS[rangeKey] ?? RANGE_IN_DAYS['7d'];
  const now = new Date();
  const from = new Date(now.getTime() - (days - 1) * DAY_IN_MS);
  return {
    fromIso: from.toISOString(),
    toIso: now.toISOString(),
  };
};

const buildTimelineSeries = (groups) => {
  const totals = new Map();

  groups.forEach((group) => {
    group.breakdown.forEach((entry) => {
      const current = totals.get(entry.date) ?? { leads: 0, contacted: 0, won: 0 };
      current.leads += entry.metrics.total;
      current.contacted += entry.metrics.contacted;
      current.won += entry.metrics.won;
      totals.set(entry.date, current);
    });
  });

  return Array.from(totals.entries())
    .sort(([dateA], [dateB]) => (dateA < dateB ? -1 : dateA > dateB ? 1 : 0))
    .map(([date, metrics]) => ({
      date,
      leads: metrics.leads,
      contacted: metrics.contacted,
      won: metrics.won,
    }));
};

const buildPieData = (groups) =>
  groups.map((group, index) => ({
    name: group.label,
    value: group.metrics.total,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

const formatPercentage = (value) => `${(value * 100).toFixed(1)}%`;

const formatDuration = (seconds) => {
  if (seconds == null) {
    return '—';
  }
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
};

const fetchReportsMetrics = async ({ groupBy, fromIso, toIso }) => {
  const params = new URLSearchParams({
    groupBy,
    from: fromIso,
    to: toIso,
  });

  const response = await apiGet(`/api/reports/metrics?${params.toString()}`);
  const payload = response && typeof response === 'object' ? response : {};

  if ('success' in payload && payload.success === false) {
    const message = payload?.error?.message ?? 'Falha ao carregar métricas.';
    throw new Error(message);
  }

  const root = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const summary = parseMetricsSnapshot(root?.summary);
  const groups = Array.isArray(root?.groups)
    ? root.groups
        .map(parseGroup)
        .filter(Boolean)
    : [];
  const totalGroups = typeof root?.totalGroups === 'number' ? root.totalGroups : groups.length;
  const period =
    root?.period && typeof root.period === 'object'
      ? {
          from: typeof root.period.from === 'string' ? root.period.from : fromIso,
          to: typeof root.period.to === 'string' ? root.period.to : toIso,
        }
      : { from: fromIso, to: toIso };

  const resolvedGroupBy = typeof root?.groupBy === 'string' ? root.groupBy : groupBy;

  return {
    summary,
    groups,
    totalGroups,
    period,
    groupBy: resolvedGroupBy,
  };
};

const LoadingSkeleton = () => (
  <div className="p-6 space-y-6">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <div className="animate-pulse bgSurfaceOverlayQuiet h-8 w-48 rounded" />
        <div className="animate-pulse bgSurfaceOverlayQuiet h-5 w-64 rounded mt-2" />
      </div>
      <div className="flex gap-2">
        <div className="animate-pulse bgSurfaceOverlayQuiet h-9 w-28 rounded" />
        <div className="animate-pulse bgSurfaceOverlayQuiet h-9 w-36 rounded" />
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {TIME_RANGE_OPTIONS.map((option) => (
        <div key={option.key} className="animate-pulse bgSurfaceOverlayQuiet h-9 w-20 rounded" />
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="animate-pulse bgSurfaceOverlayQuiet h-32 rounded" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="animate-pulse bgSurfaceOverlayQuiet h-80 rounded" />
      <div className="animate-pulse bgSurfaceOverlayQuiet h-80 rounded" />
    </div>
    <div className="animate-pulse bgSurfaceOverlayQuiet h-72 rounded" />
  </div>
);

const ReportsHeader = ({ groupBy, onDimensionChange, isRefreshing }) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    <div>
      <h1 className="text-3xl font-bold">Relatórios e Insights</h1>
      <p className="textForegroundMuted mt-1">Acompanhe o desempenho dos seus leads e campanhas</p>
      {isRefreshing ? <p className="text-xs textForegroundMuted mt-1">Atualizando métricas…</p> : null}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Select value={groupBy} onValueChange={onDimensionChange}>
        <SelectTrigger size="sm" className="min-w-[180px]" aria-label="Dimensão">
          <SelectValue placeholder="Dimensão" />
        </SelectTrigger>
        <SelectContent>
          {DIMENSION_OPTIONS.map((option) => (
            <SelectItem key={option.key} value={option.key}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm">
        <Download className="w-4 h-4 mr-2" />
        Exportar
      </Button>
    </div>
  </div>
);

const TimeRangeFilters = ({ activeRange, onSelect }) => (
  <div className="flex flex-wrap gap-2">
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

const SummaryCard = ({ title, value, description }) => (
  <Card>
    <CardHeader className="space-y-1 pb-2">
      <CardTitle className="text-sm textForegroundMuted font-medium">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description ? <p className="text-xs textForegroundMuted mt-1">{description}</p> : null}
    </CardContent>
  </Card>
);

const LeadsBarChartCard = ({ timeline }) => (
  <Card>
    <CardHeader>
      <CardTitle>Série temporal de leads</CardTitle>
      <CardDescription>Distribuição diária por status</CardDescription>
    </CardHeader>
    <CardContent className="h-80">
      {timeline.length === 0 ? (
        <div className="h-full flex items-center justify-center textForegroundMuted text-sm">Sem dados no período selecionado</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(value) => dateFormatter.format(new Date(value))} />
            <YAxis allowDecimals={false} />
            <Tooltip
              labelFormatter={(value) => dateFormatter.format(new Date(value))}
              formatter={(value, name) => {
                const label = name === 'won' ? 'Convertidos' : name === 'contacted' ? 'Contactados' : 'Leads';
                return [numberFormatter.format(value), label];
              }}
            />
            <Bar dataKey="leads" fill="var(--color-chart-1)" name="Leads" />
            <Bar dataKey="contacted" fill="var(--color-chart-2)" name="Contactados" />
            <Bar dataKey="won" fill="var(--color-chart-3)" name="Convertidos" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);

const DistributionCard = ({ data, dimensionLabel }) => (
  <Card>
    <CardHeader>
      <CardTitle>Distribuição por {dimensionLabel.toLowerCase()}</CardTitle>
      <CardDescription>Participação de cada segmento</CardDescription>
    </CardHeader>
    <CardContent className="h-80">
      {data.length === 0 ? (
        <div className="h-full flex items-center justify-center textForegroundMuted text-sm">Sem dados disponíveis</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={90} fill="var(--color-chart-1)" dataKey="value" label>
              {data.map((entry, index) => (
                <Cell key={entry.name ?? index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [numberFormatter.format(value), name]} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);

const GroupsTable = ({ groups }) => (
  <Card>
    <CardHeader>
      <CardTitle>Performance detalhada</CardTitle>
      <CardDescription>Métricas agregadas por segmento</CardDescription>
    </CardHeader>
    <CardContent>
      {groups.length === 0 ? (
        <div className="text-sm textForegroundMuted">Nenhum dado encontrado para o filtro selecionado.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Segmento</th>
                <th className="p-2 text-right">Leads</th>
                <th className="p-2 text-right">Contactados</th>
                <th className="p-2 text-right">Convertidos</th>
                <th className="p-2 text-right">Perdidos</th>
                <th className="p-2 text-right">Taxa de conversão</th>
                <th className="p-2 text-right">Tempo médio</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, index) => (
                <tr key={group.key} className={index === groups.length - 1 ? undefined : 'border-b'}>
                  <td className="p-2 font-medium">{group.label}</td>
                  <td className="p-2 text-right">{numberFormatter.format(group.metrics.total)}</td>
                  <td className="p-2 text-right">{numberFormatter.format(group.metrics.contacted)}</td>
                  <td className="p-2 text-right">{numberFormatter.format(group.metrics.won)}</td>
                  <td className="p-2 text-right">{numberFormatter.format(group.metrics.lost)}</td>
                  <td className="p-2 text-right">{formatPercentage(group.metrics.conversionRate)}</td>
                  <td className="p-2 text-right">{formatDuration(group.metrics.averageResponseSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardContent>
  </Card>
);

const Reports = () => {
  const [timeRange, setTimeRange] = useState(TIME_RANGE_OPTIONS[0].key);
  const [groupBy, setGroupBy] = useState(DIMENSION_OPTIONS[0].key);

  const { fromIso, toIso } = useMemo(() => computeRange(timeRange), [timeRange]);

  const query = useQuery({
    queryKey: ['reports', 'metrics', groupBy, fromIso, toIso],
    queryFn: () => fetchReportsMetrics({ groupBy, fromIso, toIso }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    keepPreviousData: true,
  });

  if (query.isLoading && !query.data) {
    return <LoadingSkeleton />;
  }

  const data = query.data ?? {
    summary: { ...EMPTY_METRICS },
    groups: [],
    totalGroups: 0,
    period: { from: fromIso, to: toIso },
    groupBy,
  };

  const summaryCards = [
    {
      title: 'Leads recebidos',
      value: numberFormatter.format(data.summary.total),
      description: 'Total de leads alocados no período',
    },
    {
      title: 'Contactados',
      value: numberFormatter.format(data.summary.contacted),
      description: 'Leads com algum contato registrado',
    },
    {
      title: 'Convertidos',
      value: numberFormatter.format(data.summary.won),
      description: 'Total de leads ganhos',
    },
    {
      title: 'Taxa de conversão',
      value: formatPercentage(data.summary.conversionRate),
      description: `Tempo médio de resposta: ${formatDuration(data.summary.averageResponseSeconds)}`,
    },
  ];

  const timeline = useMemo(() => buildTimelineSeries(data.groups), [data.groups]);
  const pieData = useMemo(() => buildPieData(data.groups.slice(0, 6)), [data.groups]);
  const dimensionLabel = useMemo(() => {
    const option = DIMENSION_OPTIONS.find((item) => item.key === groupBy);
    return option ? option.label : 'Segmento';
  }, [groupBy]);

  return (
    <div className="p-6 space-y-6">
      <ReportsHeader groupBy={groupBy} onDimensionChange={setGroupBy} isRefreshing={query.isFetching} />
      <TimeRangeFilters activeRange={timeRange} onSelect={setTimeRange} />
      {query.isError ? (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar as métricas. Tente novamente mais tarde.
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card) => (
          <SummaryCard key={card.title} title={card.title} value={card.value} description={card.description} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadsBarChartCard timeline={timeline} />
        <DistributionCard data={pieData} dimensionLabel={dimensionLabel} />
      </div>
      <GroupsTable groups={data.groups} />
    </div>
  );
};

export default Reports;
