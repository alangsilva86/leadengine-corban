import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare, RefreshCcw, Sparkles, Trophy, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { apiGet, apiPatch, apiPost } from '@/lib/api.js';

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

const LeadInbox = ({ selectedAgreement, campaign, onboarding, onSelectAgreement, onBackToWhatsApp }) => {
  const [allocations, setAllocations] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState(null);

  const agreementId = selectedAgreement?.id;
  const campaignId = campaign?.id;
  const batchSize = selectedAgreement?.suggestedBatch || 10;
  const stageIndex = onboarding?.stages?.findIndex((stage) => stage.id === 'inbox') ?? 3;
  const totalStages = onboarding?.stages?.length ?? 0;
  const stepNumber = stageIndex >= 0 ? stageIndex + 1 : 4;
  const stepLabel = totalStages ? `Passo ${Math.min(stepNumber, totalStages)} de ${totalStages}` : 'Passo 4';

  const loadAllocations = useCallback(async () => {
    if (!agreementId && !campaignId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (campaignId) params.set('campaignId', campaignId);
      else if (agreementId) params.set('agreementId', agreementId);
      const payload = await apiGet(`/api/lead-engine/allocations?${params.toString()}`);
      setAllocations(payload.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar leads');
    } finally {
      setLoading(false);
    }
  }, [agreementId, campaignId]);

  useEffect(() => {
    loadAllocations();
  }, [loadAllocations]);

  const handlePull = async () => {
    if (!agreementId || !campaignId) return;
    try {
      setPulling(true);
      setError(null);
      await apiPost('/api/lead-engine/allocations', {
        campaignId,
        agreementId,
        take: batchSize,
      });
      await loadAllocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível buscar novos leads');
    } finally {
      setPulling(false);
    }
  };

  const handleExport = () => {
    if (!campaignId && !agreementId) return;
    const params = new URLSearchParams();
    if (campaignId) params.set('campaignId', campaignId);
    if (agreementId) params.set('agreementId', agreementId);
    window.open(`/api/lead-engine/allocations/export?${params.toString()}`, '_blank');
  };

  const handleUpdateStatus = async (allocationId, status) => {
    try {
      const payload = await apiPatch(`/api/lead-engine/allocations/${allocationId}`, { status });
      setAllocations((current) =>
        current.map((item) => (item.allocationId === allocationId ? payload.data : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o lead');
    }
  };

  const summary = useMemo(() => {
    const total = allocations.length;
    const contacted = allocations.filter((item) => item.status === 'contacted').length;
    const won = allocations.filter((item) => item.status === 'won').length;
    const lost = allocations.filter((item) => item.status === 'lost').length;
    return { total, contacted, won, lost };
  }, [allocations]);

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
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando leads...
            </div>
          ) : null}

          {!loading && filteredAllocations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)]/70 p-6 text-center text-sm text-muted-foreground">
              <p>
                Nenhum lead disponível ainda. Clique em <strong>Buscar novos leads ({batchSize})</strong> para solicitar um novo lote ao Lead Engine.
              </p>
              <Button size="sm" className="mt-4" onClick={handlePull} disabled={pulling}>
                <Sparkles className="mr-2 h-4 w-4" /> Buscar agora
              </Button>
            </div>
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
                    <div className="mt-2 text-sm text-muted-foreground">
                      Margem disponível:{' '}
                      <span className="font-medium text-foreground">
                        {allocation.netMargin ? allocation.netMargin.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                      </span>
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
