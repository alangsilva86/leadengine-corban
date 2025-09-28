import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { QrCode, CheckCircle2, Link2, ArrowLeft, RefreshCcw, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { apiGet, apiPost } from '@/lib/api.js';

const statusCopy = {
  disconnected: {
    badge: 'Pendente',
    description: 'Leia o QR Code no WhatsApp Web para conectar seu número e começar a receber leads.',
    tone: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  },
  connecting: {
    badge: 'Conectando',
    description: 'Estamos sincronizando com o seu número. Mantenha o WhatsApp aberto até concluir.',
    tone: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  },
  connected: {
    badge: 'Ativo',
    description: 'Pronto! Todos os leads qualificados serão entregues diretamente no seu WhatsApp.',
    tone: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  },
  qr_required: {
    badge: 'QR necessário',
    description: 'Gere um novo QR Code e escaneie para reativar a sessão.',
    tone: 'border-purple-500/40 bg-purple-500/15 text-purple-200',
  },
};

const pickMetric = (source, keys) => {
  if (!source) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== null && source[key] !== undefined) {
      return source[key];
    }
  }
  return undefined;
};

const getInstanceMetrics = (instance) => {
  const metricsSource = instance?.metrics || instance?.stats || instance || {};
  const sent = pickMetric(metricsSource, ['messagesSent', 'sent', 'totalSent', 'enviadas', 'messages']) ?? 0;
  const queued = pickMetric(metricsSource, ['queued', 'pending', 'fila', 'queueSize', 'waiting']) ?? 0;
  const failed = pickMetric(metricsSource, ['failed', 'errors', 'falhas', 'errorCount']) ?? 0;
  return { sent, queued, failed };
};

const getStatusInfo = (instance) => {
  const rawStatus = instance?.status || (instance?.connected ? 'connected' : 'disconnected');
  const map = {
    connected: { label: 'Conectado', variant: 'success' },
    connecting: { label: 'Conectando', variant: 'info' },
    disconnected: { label: 'Desconectado', variant: 'secondary' },
    qr_required: { label: 'QR necessário', variant: 'warning' },
    error: { label: 'Erro', variant: 'destructive' },
  };
  return map[rawStatus] || { label: rawStatus || 'Indefinido', variant: 'secondary' };
};

const formatMetricValue = (value) => {
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR');
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return '—';
};

const getQrImageSrc = (qrPayload) => {
  if (!qrPayload) return null;
  const code = qrPayload.qrCode || qrPayload.image || (typeof qrPayload === 'string' ? qrPayload : null);
  if (!code) return null;
  if (code.startsWith('data:') || code.startsWith('http')) {
    return code;
  }
  return `data:image/png;base64,${code}`;
};

const formatPhoneNumber = (value) => {
  if (!value) return '—';
  const digits = `${value}`.replace(/\D/g, '');
  if (digits.length < 10) return value;
  const ddd = digits.slice(0, 2);
  const nine = digits.length > 10 ? digits.slice(2, 3) : '';
  const prefix = digits.length > 10 ? digits.slice(3, 7) : digits.slice(2, 6);
  const suffix = digits.length > 10 ? digits.slice(7) : digits.slice(6);
  return `(${ddd}) ${nine}${prefix}-${suffix}`;
};

const WhatsAppConnect = ({
  selectedAgreement,
  status = 'disconnected',
  activeCampaign,
  onboarding,
  onStatusChange,
  onCampaignReady,
  onContinue,
  onBack,
}) => {
  const pollIdRef = useRef(0);
  const [instances, setInstances] = useState([]);
  const [instance, setInstance] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [error, setError] = useState(null);
  const [localStatus, setLocalStatus] = useState(status);
  const [campaign, setCampaign] = useState(activeCampaign || null);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [isQrDialogOpen, setQrDialogOpen] = useState(false);

  const copy = statusCopy[localStatus] ?? statusCopy.disconnected;

  const expiresAt = useMemo(() => {
    if (!qrData?.expiresAt) return null;
    return new Date(qrData.expiresAt).getTime();
  }, [qrData]);

  const stageIndex = onboarding?.stages?.findIndex((stage) => stage.id === 'whatsapp') ?? 2;
  const totalStages = onboarding?.stages?.length ?? 0;
  const stepNumber = stageIndex >= 0 ? stageIndex + 1 : 3;
  const stepLabel = totalStages ? `Passo ${Math.min(stepNumber, totalStages)} de ${totalStages}` : 'Passo 3';
  const nextStage = onboarding?.stages?.[Math.min(stageIndex + 1, totalStages - 1)]?.label ?? 'Inbox de Leads';
  const hasAgreement = Boolean(selectedAgreement);
  const hasCampaign = Boolean(campaign);
  const qrImageSrc = getQrImageSrc(qrData);
  const hasQr = Boolean(qrImageSrc);
  const canContinue = localStatus === 'connected' && instance && hasAgreement;
  const statusTone = copy.tone || 'border-white/10 bg-white/10 text-white';
  const countdownMessage = secondsLeft !== null ? `QR expira em ${secondsLeft}s` : null;
  const isBusy = loadingInstances || loadingQr;
  const confirmLabel = hasCampaign
    ? 'Ir para a inbox de leads'
    : creatingCampaign
    ? 'Sincronizando…'
    : 'Confirmar e criar campanha';
  const confirmDisabled = creatingCampaign || (!hasCampaign && (!canContinue || isBusy));
  const qrStatusMessage = localStatus === 'connected'
    ? 'Conexão ativa — QR oculto.'
    : countdownMessage || (loadingQr ? 'Gerando QR Code…' : 'Selecione uma instância para gerar o QR.');

  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  useEffect(() => {
    setCampaign(activeCampaign || null);
  }, [activeCampaign]);

  useEffect(() => {
    if (!selectedAgreement) return;
    void loadInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgreement?.id]);

  useEffect(() => {
    if (!selectedAgreement) {
      setCampaign(null);
      return undefined;
    }

    let cancelled = false;

    const hydrateCampaign = async () => {
      try {
        const response = await apiGet(
          `/api/lead-engine/campaigns?agreementId=${selectedAgreement.id}&status=active`
        );
        if (cancelled) return;
        const existing = Array.isArray(response?.data) ? response.data[0] : null;
        if (existing) {
          setCampaign(existing);
          onCampaignReady?.(existing);
        } else {
          setCampaign(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Não foi possível carregar campanhas existentes', err);
        }
      }
    };

    void hydrateCampaign();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgreement?.id]);

  useEffect(() => {
    if (!expiresAt || localStatus === 'connected') {
      setSecondsLeft(null);
      return undefined;
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        setLocalStatus('qr_required');
        onStatusChange?.('disconnected');
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, localStatus, onStatusChange]);

  const pickCurrentInstance = (list) => {
    if (!Array.isArray(list) || list.length === 0) {
      return null;
    }

    const connected = list.find((item) => item.connected === true);
    return connected || list[0];
  };

  const loadInstances = async () => {
    if (!selectedAgreement) return;
    setLoadingInstances(true);
    setError(null);
    try {
      const response = await apiGet('/api/integrations/whatsapp/instances');
      const list = Array.isArray(response?.data) ? response.data : [];
      setInstances(list);

      let current = null;
      if (campaign?.instanceId) {
        current =
          list.find(
            (item) => item.id === campaign.instanceId || item.name === campaign.instanceId
          ) || null;
      }

      if (!current) {
        current = pickCurrentInstance(list);
      }

      if (!current) {
        const created = await apiPost('/api/integrations/whatsapp/instances', {
          name: selectedAgreement.name,
        });
        current = created?.data || null;
        if (current) {
          setInstances([current]);
        }
      }

      setInstance(current);
      const statusFromInstance = current?.status || 'disconnected';
      setLocalStatus(statusFromInstance);
      onStatusChange?.(statusFromInstance);

      if (current && statusFromInstance !== 'connected') {
        await generateQr(current.id);
      } else {
        setQrData(null);
        setSecondsLeft(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar status do WhatsApp');
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleCreateInstance = async () => {
    if (!selectedAgreement) return;
    setLoadingInstances(true);
    setError(null);
    const defaultName = `${selectedAgreement.name} • ${instances.length + 1}`;
    try {
      const payload = await apiPost('/api/integrations/whatsapp/instances', {
        name: defaultName,
      });
      const created = payload?.data || null;
      if (created) {
        setInstances((current) => [created, ...current]);
        await handleInstanceSelect(created);
      } else {
        await loadInstances();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar uma nova instância');
    } finally {
      setLoadingInstances(false);
    }
  };

  useEffect(() => {
    if (!campaign?.instanceId || instances.length === 0) {
      return;
    }

    const matched = instances.find(
      (item) => item.id === campaign.instanceId || item.name === campaign.instanceId
    );

    if (!matched) {
      return;
    }

    setInstance(matched);
    const statusFromInstance = matched.status || 'disconnected';
    setLocalStatus(statusFromInstance);
    onStatusChange?.(statusFromInstance);
  }, [campaign?.instanceId, instances, onStatusChange]);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const generateQr = async (id) => {
    const myPollId = ++pollIdRef.current;
    setLoadingQr(true);
    setError(null);
    try {
      // Solicita reinício/logout para forçar emissão de novo QR (ignora erros de rede momentâneos)
      await apiPost(`/api/integrations/whatsapp/instances/${id}/start`, {}).catch((error) => {
        console.debug('Falha temporária ao iniciar instância do WhatsApp', error);
      });

      setLocalStatus('qr_required');
      onStatusChange?.('disconnected');

      // Polling por até 60s aguardando o QR
      const deadline = Date.now() + 60_000;
      let received = null;
      while (Date.now() < deadline) {
        if (pollIdRef.current !== myPollId) {
          // polling cancelado (nova instância/QR solicitado)
          return;
        }
        const qrResponse = await apiGet(`/api/integrations/whatsapp/instances/${id}/qr`).catch(() => null);
        if (qrResponse?.data?.qrCode) {
          received = qrResponse.data;
          break;
        }
        await sleep(1000);
      }

      if (!received) {
        throw new Error('QR não disponível no momento. Tente novamente.');
      }

      setQrData(received);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o QR Code');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleInstanceSelect = async (inst, { skipAutoQr = false } = {}) => {
    if (!inst) return;
    setInstance(inst);
    const statusFromInstance = inst.status || 'disconnected';
    setLocalStatus(statusFromInstance);
    onStatusChange?.(statusFromInstance);

    if (campaign && campaign.instanceId !== inst.id) {
      setCampaign(null);
    }

    if (!skipAutoQr && statusFromInstance !== 'connected') {
      ++pollIdRef.current; // invalida qualquer polling anterior
      await generateQr(inst.id);
    } else {
      setQrData(null);
      setSecondsLeft(null);
    }
  };

  const handleViewQr = async (inst) => {
    if (!inst) return;
    await handleInstanceSelect(inst, { skipAutoQr: true });
    await generateQr(inst.id);
    setQrDialogOpen(true);
  };

  const handleGenerateQr = async () => {
    if (!instance) return;
    await generateQr(instance.id);
  };

  const handleMarkConnected = async () => {
    if (!instance?.id) return;
    try {
      // Valida com o servidor, se rota existir
      const status = await apiGet(`/api/integrations/whatsapp/instances/${instance.id}/status`).catch(() => null);
      const connected = Boolean(status?.data?.connected);
      if (!connected) {
        setError('A instância ainda não está conectada. Escaneie o QR e tente novamente.');
        return;
      }
    } catch {
      // Continua em modo otimista caso a rota não exista
    }
    setLocalStatus('connected');
    setQrData(null);
    setSecondsLeft(null);
    setQrDialogOpen(false);
    onStatusChange?.('connected');
  };

  const handleContinue = async () => {
    if (localStatus !== 'connected' || !instance || !selectedAgreement) return;

    setCreatingCampaign(true);
    setError(null);

    try {
      const payload = await apiPost('/api/lead-engine/campaigns', {
        agreementId: selectedAgreement.id,
        instanceId: instance.id,
        name: `${selectedAgreement.name} • ${instance.name || instance.id}`,
        status: 'active',
      });

      const createdCampaign = payload?.data || null;
      if (createdCampaign) {
        setCampaign(createdCampaign);
        onCampaignReady?.(createdCampaign);
      }

      onContinue?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a campanha');
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleConfirm = async () => {
    if (hasCampaign) {
      onContinue?.();
      return;
    }
    await handleContinue();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="glass-surface space-y-4 rounded-[var(--radius)] border border-[var(--border)] px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-300/80">
              <Badge variant="secondary">{stepLabel}</Badge>
              <span>Próximo: {nextStage}</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Conecte seu WhatsApp</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Utilize o QR Code para sincronizar o número que você usa com os clientes. Após a conexão, o Lead Engine entrega
                automaticamente os leads aquecidos pelo convênio selecionado.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${statusTone}`}>
              <span className="font-medium text-foreground/90">{copy.badge}</span>
            </span>
            {hasAgreement ? (
              <span>
                Convênio ativo:{' '}
                <span className="font-medium text-foreground">{selectedAgreement.name}</span>
              </span>
            ) : (
              <span>Selecione um convênio para liberar esta etapa.</span>
            )}
            {countdownMessage ? (
              <span className="flex items-center gap-1 text-amber-200">
                <Clock className="h-3.5 w-3.5" />
                {countdownMessage}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Voltar aos convênios
          </Button>
          <Separator className="section-divider flex-1" />
          <span>{copy.description}</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border border-[var(--border)]/60 bg-[rgba(15,23,42,0.5)]">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Painel de instâncias</CardTitle>
              <CardDescription>
                Vincule o número certo ao convênio e confirme para avançar para {nextStage}.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleCreateInstance()}
              disabled={isBusy || !hasAgreement}
            >
              + Nova instância
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 rounded-[var(--radius)] border border-white/10 bg-white/5 p-4 text-sm">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Convênio</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {selectedAgreement?.name ?? 'Selecione um convênio'}
                  </p>
                  {selectedAgreement?.region ? (
                    <p className="text-xs text-muted-foreground">{selectedAgreement.region}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Instância selecionada</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {instance?.name || instance?.id || 'Escolha uma instância'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {instance ? formatPhoneNumber(instance.phoneNumber || instance.number) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Campanha</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {hasCampaign ? campaign.name : 'Será criada após a confirmação'}
                  </p>
                  {hasCampaign && campaign.updatedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Atualizada em {new Date(campaign.updatedAt).toLocaleString('pt-BR')}
                    </p>
                  ) : hasCampaign ? (
                    <p className="text-xs text-muted-foreground">
                      Instância vinculada: {campaign.instanceName || campaign.instanceId}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Será ligada ao número selecionado.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-300/70">
                <span>Instâncias disponíveis</span>
                <span>{instances.length} ativa(s)</span>
              </div>
              {instances.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {instances.map((item, index) => {
                    const isCurrent = instance?.id === item.id;
                    const statusInfo = getStatusInfo(item);
                    const metrics = getInstanceMetrics(item);
                    const phoneLabel =
                      item.phoneNumber || item.number || item.msisdn || item.jid || item.session || '';
                    const addressLabel = item.address || item.jid || item.session || '';
                    const lastUpdated = item.updatedAt || item.lastSeen || item.connectedAt;
                    const lastUpdatedLabel = lastUpdated
                      ? new Date(lastUpdated).toLocaleString('pt-BR')
                      : '—';

                    return (
                      <div
                        key={item.id || item.name || index}
                        className={cn(
                          'flex h-full flex-col rounded-2xl border p-4 transition-colors',
                          isCurrent
                            ? 'border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(99,102,241,0.45)]'
                            : 'border-white/10 bg-white/5 hover:border-primary/30'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{item.name || item.id}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatPhoneNumber(phoneLabel) || '—'}
                            </p>
                            {addressLabel && addressLabel !== phoneLabel ? (
                              <p className="text-xs text-muted-foreground">{addressLabel}</p>
                            ) : null}
                          </div>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Enviadas</p>
                            <p className="mt-1 text-base font-semibold text-foreground">
                              {formatMetricValue(metrics.sent)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Na fila</p>
                            <p className="mt-1 text-base font-semibold text-foreground">
                              {formatMetricValue(metrics.queued)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Falhas</p>
                            <p className="mt-1 text-base font-semibold text-foreground">
                              {formatMetricValue(metrics.failed)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>Atualizado: {lastUpdatedLabel}</span>
                          {item.user ? <span>Operador: {item.user}</span> : null}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={isCurrent ? 'default' : 'outline'}
                            onClick={() => void handleInstanceSelect(item)}
                            disabled={isBusy}
                          >
                            {isCurrent ? 'Instância selecionada' : 'Selecionar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleViewQr(item)}
                            disabled={isBusy}
                          >
                            <QrCode className="mr-2 h-3.5 w-3.5" /> Ver QR
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
                  <p>Nenhuma instância encontrada. Crie uma nova para iniciar a sincronização com o convênio selecionado.</p>
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() => void handleCreateInstance()}
                    disabled={isBusy || !hasAgreement}
                  >
                    Criar instância agora
                  </Button>
                </div>
              )}
            </div>

            {error ? (
              <div className="flex flex-wrap items-start gap-3 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium">Algo deu errado</p>
                  <p>{error}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void loadInstances()}>
                  Tentar novamente
                </Button>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link2 className="h-4 w-4" />
              Status atual: <span className="font-medium text-foreground">{copy.badge}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {localStatus !== 'connected' ? (
                <Button onClick={handleMarkConnected} disabled={isBusy}>
                  Marcar como conectado
                </Button>
              ) : null}
              <Button onClick={() => void handleConfirm()} disabled={confirmDisabled}>
                {confirmLabel}
              </Button>
            </div>
          </CardFooter>
        </Card>

        <Card className="border border-[var(--border)]/60 bg-[rgba(15,23,42,0.35)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code e instruções
            </CardTitle>
            <CardDescription>Escaneie com o aplicativo oficial para ativar a sessão.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 bg-white/5 p-6">
              <div className="flex h-44 w-44 items-center justify-center rounded-2xl border border-[rgba(99,102,241,0.25)] bg-[rgba(99,102,241,0.08)] text-primary shadow-inner">
                {hasQr ? (
                  <img src={qrImageSrc} alt="QR Code do WhatsApp" className="h-36 w-36 rounded-lg shadow-inner" />
                ) : (
                  <QrCode className="h-24 w-24" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                <Clock className="h-3.5 w-3.5" />
                {qrStatusMessage}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleGenerateQr()}
                  disabled={isBusy || !instance}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Gerar novo QR
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQrDialogOpen(true)}
                  disabled={!hasQr}
                >
                  Abrir em tela cheia
                </Button>
              </div>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <p>Use o número que já interage com os clientes. Não é necessário chip ou aparelho adicional.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <p>O Lead Engine garante distribuição automática. Você só recebe quando o servidor responde “quero falar”.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <p>Se perder a conexão, repita o processo — seus leads permanecem reservados na sua inbox.</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Dica para evitar bloqueios</p>
            <p className="mt-1">
              Mantenha o aplicativo oficial aberto e responda às mensagens em até 15 minutos. A inteligência do Lead Engine cuida do aquecimento automático do número.
            </p>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={isQrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl border border-[rgba(99,102,241,0.25)] bg-[rgba(99,102,241,0.08)] text-primary shadow-inner">
              {hasQr ? (
                <img src={qrImageSrc} alt="QR Code do WhatsApp" className="h-56 w-56 rounded-lg shadow-inner" />
              ) : (
                <QrCode className="h-32 w-32" />
              )}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Abra o WhatsApp &gt; Configurações &gt; Dispositivos Conectados &gt; Conectar dispositivo e escaneie o QR Code exibido.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppConnect;
