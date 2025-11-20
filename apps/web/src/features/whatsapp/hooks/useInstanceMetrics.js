import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCallback, useMemo, useState } from 'react';

import { formatTimestampLabel } from '../lib/formatting.js';
import { resolveConnectionState } from '../lib/connectionStates.js';

const formatRelativeTime = (date) => {
  if (!date) return '—';
  try {
    return formatDistanceToNowStrict(date, { addSuffix: true, locale: ptBR });
  } catch {
    return formatTimestampLabel(date);
  }
};

export const computeLoadLevel = (metrics = {}, ratePercentage = 0) => {
  const queued = Number(metrics.queued ?? 0);
  const failed = Number(metrics.failed ?? 0);
  const usage = Number(ratePercentage ?? 0);

  if (queued > 50 || failed > 10 || usage >= 90) {
    return 'alta';
  }

  if (queued > 10 || failed > 0 || usage >= 75) {
    return 'media';
  }

  return 'baixa';
};

export const computeHealthScore = (connectionState, metrics = {}, ratePercentage = 0) => {
  let score = 100;
  const queued = Number(metrics.queued ?? 0);
  const failed = Number(metrics.failed ?? 0);
  const usage = Number(ratePercentage ?? 0);

  if (connectionState === 'attention' || connectionState === 'reconnecting') {
    score -= 25;
  }

  if (connectionState === 'disconnected') {
    score -= 60;
  }

  score -= Math.min(queued, 150) * 0.3;
  score -= Math.min(failed, 60) * 1.2;
  score -= Math.max(usage - 85, 0) * 1.5;

  return Math.max(0, Math.min(100, Math.round(score)));
};

export const categorizeHealth = (score) => {
  if (score >= 70) return 'alta';
  if (score >= 40) return 'media';
  return 'baixa';
};

export const resolveProvider = (instance) => {
  if (!instance || typeof instance !== 'object') {
    return null;
  }

  const record = instance;
  const metadata = record?.metadata && typeof record.metadata === 'object' ? record.metadata : {};
  const providerCandidates = [
    record.provider,
    record.providerName,
    record.vendor,
    metadata.provider,
    metadata.providerName,
    metadata.vendor,
  ];

  for (const candidate of providerCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
};

export const resolveTimestamp = (instance) => {
  if (!instance || typeof instance !== 'object') {
    return null;
  }

  const candidates = [instance.syncedAt, instance.updatedAt, instance.lastSeen, instance.connectedAt, instance.createdAt];

  const timestamps = candidates
    .map((value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    })
    .filter(Boolean);

  if (!timestamps.length) {
    return null;
  }

  return timestamps.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
};

const buildSearchBlob = (viewModel, provider) => {
  const blob = [
    viewModel.displayName,
    viewModel.formattedPhone,
    viewModel.phoneLabel,
    viewModel.instance?.id,
    viewModel.instance?.name,
    provider,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return blob;
};

export const useInstanceMetrics = ({ instanceViewModels, instancesReady }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [sortBy, setSortBy] = useState('health');

  const enrichedInstances = useMemo(() => {
    return instanceViewModels.map((viewModel) => {
      const connectionState = resolveConnectionState(viewModel.statusInfo);
      const loadLevel = computeLoadLevel(viewModel.metrics, viewModel.ratePercentage);
      const healthScore = computeHealthScore(connectionState, viewModel.metrics, viewModel.ratePercentage);
      const provider = resolveProvider(viewModel.instance);
      const lastTimestamp = resolveTimestamp(viewModel.instance);

      return {
        ...viewModel,
        connectionState,
        loadLevel,
        provider,
        healthScore,
        healthCategory: categorizeHealth(healthScore),
        queueSize: Number(viewModel.metrics?.queued ?? 0),
        failureCount: Number(viewModel.metrics?.failed ?? 0),
        usagePercentage: Number(viewModel.ratePercentage ?? 0),
        lastTimestamp,
        relativeUpdated: formatRelativeTime(lastTimestamp),
        searchBlob: buildSearchBlob(viewModel, provider),
      };
    });
  }, [instanceViewModels]);

  const providerOptions = useMemo(() => {
    const providers = new Set();
    enrichedInstances.forEach((item) => {
      if (item.provider) {
        providers.add(item.provider);
      }
    });
    return Array.from(providers).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [enrichedInstances]);

  const filteredInstances = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return enrichedInstances
      .filter((item) => {
        if (normalizedSearch && !item.searchBlob.includes(normalizedSearch)) {
          return false;
        }

        if (statusFilter !== 'all' && item.connectionState !== statusFilter) {
          return false;
        }

        if (healthFilter !== 'all' && item.healthCategory !== healthFilter) {
          return false;
        }

        if (providerFilter !== 'all') {
          if (!item.provider) {
            return false;
          }
          if (item.provider !== providerFilter) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.displayName.localeCompare(b.displayName, 'pt-BR');
          case 'updated':
            return (b.lastTimestamp?.getTime() ?? 0) - (a.lastTimestamp?.getTime() ?? 0);
          case 'load':
            return b.queueSize - a.queueSize;
          case 'health':
          default:
            return b.healthScore - a.healthScore;
        }
      });
  }, [enrichedInstances, healthFilter, providerFilter, searchTerm, sortBy, statusFilter]);

  const summary = useMemo(() => {
    if (!instancesReady) {
      return {
        state: 'loading',
        totals: { connected: 0, attention: 0, reconnecting: 0, disconnected: 0 },
        queueTotal: 0,
        failureTotal: 0,
        usageAverage: 0,
        lastSyncLabel: '—',
        healthScore: 0,
        total: instanceViewModels.length,
      };
    }

    if (enrichedInstances.length === 0) {
      return {
        state: 'empty',
        totals: { connected: 0, attention: 0, reconnecting: 0, disconnected: 0 },
        queueTotal: 0,
        failureTotal: 0,
        usageAverage: 0,
        lastSyncLabel: '—',
        healthScore: 0,
        total: 0,
      };
    }

    const totals = { connected: 0, attention: 0, reconnecting: 0, disconnected: 0 };
    let queueTotal = 0;
    let failureTotal = 0;
    let usageAccumulator = 0;
    let usageCount = 0;
    let healthAccumulator = 0;
    let lastSyncDate = null;

    enrichedInstances.forEach((item) => {
      totals[item.connectionState] = (totals[item.connectionState] ?? 0) + 1;
      queueTotal += item.queueSize;
      failureTotal += item.failureCount;
      if (Number.isFinite(item.usagePercentage)) {
        usageAccumulator += item.usagePercentage;
        usageCount += 1;
      }
      healthAccumulator += item.healthScore;
      if (item.lastTimestamp) {
        if (!lastSyncDate || item.lastTimestamp.getTime() > lastSyncDate.getTime()) {
          lastSyncDate = item.lastTimestamp;
        }
      }
    });

    const usageAverage = usageCount ? Math.round(usageAccumulator / usageCount) : 0;
    const channelHealth = Math.round(healthAccumulator / enrichedInstances.length);
    const lastSyncLabel = formatRelativeTime(lastSyncDate);

    return {
      state: 'ready',
      totals,
      queueTotal,
      failureTotal,
      usageAverage,
      lastSyncLabel,
      healthScore: channelHealth,
      total: enrichedInstances.length,
    };
  }, [enrichedInstances, instanceViewModels.length, instancesReady]);

  const priorityInstance = useMemo(() => {
    if (!enrichedInstances.length) return null;
    const sorted = [...enrichedInstances].sort((a, b) => {
      const connectionScore = (state) => {
        if (state === 'disconnected') return 3;
        if (state === 'attention') return 2;
        return 1;
      };
      const scoreA = connectionScore(a.connectionState) * 1000 + a.queueSize * 2 + a.failureCount * 5;
      const scoreB = connectionScore(b.connectionState) * 1000 + b.queueSize * 2 + b.failureCount * 5;
      return scoreB - scoreA;
    });
    return sorted[0];
  }, [enrichedInstances]);

  const filtersApplied = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count += 1;
    if (statusFilter !== 'all') count += 1;
    if (healthFilter !== 'all') count += 1;
    if (providerFilter !== 'all') count += 1;
    return count;
  }, [healthFilter, providerFilter, searchTerm, statusFilter]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setHealthFilter('all');
    setProviderFilter('all');
  }, []);

  return {
    enrichedInstances,
    filteredInstances,
    providerOptions,
    summary,
    priorityInstance,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    healthFilter,
    setHealthFilter,
    providerFilter,
    setProviderFilter,
    sortBy,
    setSortBy,
    filtersApplied,
    activeInstances: filteredInstances.length,
    handleClearFilters,
  };
};

export default useInstanceMetrics;
