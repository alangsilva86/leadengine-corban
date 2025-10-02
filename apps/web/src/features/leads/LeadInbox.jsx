import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare, RefreshCcw, Trophy, XCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { apiGet, apiPatch, apiPost } from '@/lib/api.js';
import { computeBackoffDelay, parseRetryAfterMs } from '@/lib/rate-limit.js';
import usePlayfulLogger from '../shared/usePlayfulLogger.js';
import EmptyInboxState from './components/EmptyInboxState.jsx';
import useRateLimitBanner from '@/hooks/useRateLimitBanner.js';

const statusVariant = {
  allocated: 'info',
  contacted: 'secondary',
  won: 'success',
  lost: 'destructive',
};

const statusLabel = {
  allocated: 'Aguardando contato',
  contacted: 'Em conversa',
  won: 'Venda realizada',
  lost: 'Sem interesse',
};

const formatSeconds = (seconds) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return '—';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

const formatCurrency = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const LeadInbox = ({ selectedAgreement, campaign, onboarding, onSelectAgreement, onBackToWhatsApp }) => {
  const { log, warn, error: logError } = usePlayfulLogger('✨ LeadEngine • Inbox');
  const [allocations, setAllocations] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState(null);
  const [warningMessage, setWarningMessage] = useState(null);
  const rateLimitInfo = useRateLimitBanner();
  const campaignMetrics = campaign?.metrics;

  const loadingRef = useRef(false);
  const retryStateRef = useRef({ attempts: 0, timeoutId: null });

  const clearScheduledReload = useCallback(() => {
    if (retryStateRef.current.timeoutId) {
      clearTimeout(retryStateRef.current.timeoutId);
      retryStateRef.current.timeoutId = null;
    }
  }, []);

  const resetRateLimiter = useCallback(() => {
    retryStateRef.current.attempts = 0;
    clearScheduledReload();
  }, [clearScheduledReload]);

  const loadAllocationsRef = useRef(() => {});

  const scheduleNextLoad = useCallback(
    (retryAfterMs) => {
      const attempts = retryStateRef.current.attempts + 1;
      retryStateRef.current.attempts = attempts;
      const waitMs =
        typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs)
          ? Math.max(0, retryAfterMs)
          : computeBackoffDelay(attempts);

      clearScheduledReload();

      retryStateRef.current.timeoutId = setTimeout(() => {
        retryStateRef.current.timeoutId = null;
        loadAllocationsRef.current?.();
      }, waitMs);

      return waitMs;
    },
    [clearScheduledReload]
  );

  const agreementId = selectedAgreement?.id;
  const campaignId = campaign?.id;
  const batchSize = selectedAgreement?.suggestedBatch || 10;
  const stageIndex = onboarding?.stages?.findIndex((stage) => stage.id === 'inbox') ?? 3;
  const totalStages = onboarding?.stages?.length ?? 0;
  const stepNumber = stageIndex >= 0 ? stageIndex + 1 : 4;
  const stepLabel = totalStages ? `Passo ${Math.min(stepNumber, totalStages)} de ${totalStages}` : 'Passo 4';

  const loadAllocations = useCallback(async () => {
    if (!agreementId && !campaignId) {
      return;
    }

    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;

    try {
      setLoading(true);
      clearScheduledReload();

      log('📮 Sincronizando leads', {
        campaignId,
        agreementId,
      });

      const params = new URLSearchParams();
      if (campaignId) params.set('campaignId', campaignId);
      else if (agreementId) params.set('agreementId', agreementId);

      const payload = await apiGet(`/api/lead-engine/allocations?${params.toString()}`);
      const items = Array.isArray(payload?.data) ? payload.data : [];
      if (items.length === 0) {
        warn('Nenhum lead disponível no momento', {
          campaignId,
          agreementId,
        });
      }
      setAllocations(items);
      setError(null);
      const warningFromApi = payload?.meta?.warnings;
      setWarningMessage(Array.isArray(warningFromApi) && warningFromApi.length > 0 ? warningFromApi[0] : null);
      resetRateLimiter();
      log('✅ Leads sincronizados', {
        total: items.length,
        campaignId,
        agreementId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao carregar leads';
      const status = err?.status ?? err?.statusCode;
      const retryAfterMs = parseRetryAfterMs(err?.retryAfter ?? err?.payload?.retryAfter ?? err?.rateLimitDelayMs);

      if (status === 429 || status === 503 || (typeof status === 'number' && status >= 500)) {
        const waitMs = scheduleNextLoad(retryAfterMs);
        const seconds = Math.ceil(waitMs / 1000);
        setError(`Muitas requisições. Nova tentativa em ${seconds}s.`);
        warn('Broker sinalizou limite ao carregar leads', {
          campaignId,
          agreementId,
          status,
          retryAfterMs,
        });
      } else {
        resetRateLimiter();
        setError(message);
      }
      logError('Falha ao sincronizar leads', err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [agreementId, campaignId, clearScheduledReload, resetRateLimiter, scheduleNextLoad]);

  useEffect(() => {
    loadAllocationsRef.current = loadAllocations;
  }, [loadAllocations]);

  useEffect(() => {
    loadAllocations();
    return () => {
      clearScheduledReload();
    };
  }, [loadAllocations, clearScheduledReload]);

  const handlePull = async () => {
    if (!agreementId || !campaignId) return;
    try {
      setPulling(true);
      setError(null);
      log('🚚 Solicitando novo lote de leads', {
        campaignId,
        agreementId,
        take: batchSize,
      });
      await apiPost('/api/lead-engine/allocations', {
        campaignId,
        agreementId,
        take: batchSize,
      });
      resetRateLimiter();
      await loadAllocations();
      log('🎉 Lote de leads solicitado com sucesso', {
        campaignId,
        agreementId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível buscar novos leads');
      setWarningMessage(null);
      logError('Falha ao solicitar novo lote de leads', err);
    } finally {
      setPulling(false);
    }
  };

  const handleExport = () => {
    if (!campaignId && !agreementId) return;
    const params = new URLSearchParams();
    if (campaignId) params.set('campaignId', campaignId);
    if (agreementId) params.set('agreementId', agreementId);
    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    }
    if (campaign?.instanceId) {
      params.set('instanceId', campaign.instanceId);
    }
    window.open(`/api/lead-engine/allocations/export?${params.toString()}`, '_blank');
  };

  const handleUpdateStatus = async (allocationId, status) => {
    try {
      log('✏️ Atualizando status do lead', {
        allocationId,
        status,
      });
      const payload = await apiPatch(`/api/lead-engine/allocations/${allocationId}`, { status });
      setAllocations((current) =>
        current.map((item) => (item.allocationId === allocationId ? payload.data : item))
      );
      log('📌 Lead atualizado com sucesso', {
        allocationId,
        status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o lead');
      logError('Falha ao atualizar lead', err);
    }
  };

  const summary = useMemo(() => {
    if (campaignMetrics) {
      return {
        total: campaignMetrics.total,
        contacted: campaignMetrics.contacted,
        won: campaignMetrics.won,
        lost: campaignMetrics.lost,
      };
    }

    const total = allocations.length;
    const contacted = allocations.filter((item) => item.status === 'contacted').length;
    const won = allocations.filter((item) => item.status === 'won').length;
    const lost = allocations.filter((item) => item.status === 'lost').length;
    return { total, contacted, won, lost };
  }, [allocations, campaignMetrics]);

  const filteredAllocations = useMemo(() => {
    if (statusFilter === 'all') return allocations;
    return allocations.filter((allocation) => allocation.status === statusFilter);
  }, [allocations, statusFilter]);

  if (!selectedAgreement) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">Nenhum convênio selecionado</p>
          <p className="text-sm text-muted-foreground">
            Escolha um convênio para receber leads qualificados diretamente na sua inbox.
          </p>
        </div>
        <Button onClick={onSelectAgreement}>Escolher convênio</Button>
      </div>
    );
  }

  if (!campaignId) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1 max-w-lg">
          <p className="text-lg font-semibold text-foreground">Conecte um número de WhatsApp</p>
          <p className="text-sm text-muted-foreground">
            Vincule um número de WhatsApp ao convênio {selectedAgreement.name} para receber leads nesta inbox.
          </p>
        </div>
        <Button onClick={onBackToWhatsApp}>Conectar WhatsApp</Button>
      </div>
    );
  }

  const openWhatsApp = (allocation) => {
    const phone = allocation.phone?.replace(/\D/g, '');
    if (!phone) return;
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-300/80">
            <Badge variant="secondary">{stepLabel}</Badge>
            <span>Fluxo concluído</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Inbox de leads</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Leads do convênio {selectedAgreement.name}. Dispare novos lotes de {batchSize} contatos sempre que precisar reforçar a fila de atendimento.
          </p>
          {campaign?.name ? (
            <p className="text-xs text-muted-foreground">
              Campanha ativa: <span className="font-medium text-foreground">{campaign.name}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex rounded-full bg-[rgba(148,163,184,0.12)] p-1 text-xs text-muted-foreground">
            {['all', 'contacted', 'won', 'lost'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`filter-pill ${statusFilter === status ? 'filter-pill--active' : ''}`}
              >
                {status === 'all' ? 'Todos' : statusLabel[status]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" onClick={handlePull} disabled={pulling}>
              <Sparkles className="mr-2 h-4 w-4" /> Buscar novos leads ({batchSize})
            </Button>
            <Button variant="outline" size="sm" onClick={loadAllocations} disabled={loading || pulling}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              Exportar CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={onBackToWhatsApp}>
              Voltar para conexão
            </Button>
          </div>
        </div>
      </div>

      {rateLimitInfo.show ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-100">
          <Sparkles className="mr-2 inline h-4 w-4" />
          Muitas requisições! Aguarde {rateLimitInfo.retryAfter ?? rateLimitInfo.resetSeconds ?? 0}s para evitar bloqueios.
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-wrap items-center gap-4">
          <div>
            <CardTitle>Resumo</CardTitle>
            <CardDescription>Distribuição dos leads que já chegaram ao seu WhatsApp.</CardDescription>
          </div>
          <div className="ml-auto flex items-center gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Total recebido</p>
              <p className="text-lg font-semibold">{summary.total}</p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div>
              <p className="text-muted-foreground">Em conversa</p>
              <p className="text-lg font-semibold">{summary.contacted}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-muted-foreground">
                <Trophy className="h-4 w-4" /> Ganhos
              </p>
              <p className="text-lg font-semibold text-emerald-600">{summary.won}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-muted-foreground">
                <XCircle className="h-4 w-4" /> Perdidos
              </p>
              <p className="text-lg font-semibold text-destructive">{summary.lost}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaignMetrics ? (
            <div className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide">Tempo médio até contato</p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {formatSeconds(campaignMetrics.averageResponseSeconds)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide">CPL</p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {typeof campaignMetrics.cpl === 'number'
                    ? campaignMetrics.cpl.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide">Orçamento previsto</p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {typeof campaignMetrics.budget === 'number'
                    ? campaignMetrics.budget.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })
                    : '—'}
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
              <p className="text-xs text-destructive/80">
                Dica rápida: revise se o WhatsApp conectado segue ativo e, se necessário, peça um novo lote após alguns segundos.
              </p>
            </div>
          ) : null}

          {!error && warningMessage ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 p-4 text-sm text-amber-100">
              <Sparkles className="mt-0.5 h-4 w-4" />
              <span>{warningMessage}</span>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando leads...
            </div>
          ) : null}

          {!loading && filteredAllocations.length === 0 ? (
            <EmptyInboxState
              agreement={selectedAgreement}
              campaign={campaign}
              onBackToWhatsApp={onBackToWhatsApp}
              onSelectAgreement={onSelectAgreement}
              onPull={handlePull}
              pulling={pulling}
            />
          ) : null}

          {!loading && filteredAllocations.length > 0 ? (
            <div className="space-y-3">
              {filteredAllocations.map((allocation) => (
                <div
                  key={allocation.allocationId}
                  className="glass-surface flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)]/70 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-foreground">{allocation.fullName}</h3>
                      <Badge variant={statusVariant[allocation.status]}> {statusLabel[allocation.status]} </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      CPF {allocation.document} • Registro {allocation.registrations?.join(', ') || '—'} • Score{' '}
                      {allocation.score ?? '—'}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div>
                        Margem bruta:{' '}
                        <span className="font-medium text-foreground">{formatCurrency(allocation.margin)}</span>
                      </div>
                      <div>
                        Margem disponível:{' '}
                        <span className="font-medium text-foreground">{formatCurrency(allocation.netMargin)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {allocation.phone ? (
                      <Button variant="outline" size="sm" onClick={() => openWhatsApp(allocation)}>
                        Abrir conversa
                      </Button>
                    ) : null}
                    {allocation.status !== 'contacted' && allocation.status !== 'won' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus(allocation.allocationId, 'contacted')}
                      >
                        Marcar como em conversa
                      </Button>
                    ) : null}
                    {allocation.status !== 'won' ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleUpdateStatus(allocation.allocationId, 'won')}
                      >
                        Ganhei a venda
                      </Button>
                    ) : null}
                    {allocation.status !== 'lost' ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleUpdateStatus(allocation.allocationId, 'lost')}
                      >
                        Cliente sem interesse
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadInbox;
