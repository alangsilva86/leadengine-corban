import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { apiGet } from '@/lib/api.js';
import { Loader2, History } from 'lucide-react';
import usePlayfulLogger from '../../shared/usePlayfulLogger.js';

const statusTone = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  paused: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  ended: 'bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground-muted)] border-[color:var(--color-inbox-border)]',
  archived: 'bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground-muted)] border-[color:var(--color-inbox-border)]',
};

const CampaignHistoryDialog = ({ agreementId }) => {
  const { log, warn } = usePlayfulLogger('🎯 LeadEngine • Campanhas');
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!open || !agreementId) {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        log('📚 Listando campanhas cadastradas', { agreementId });
        const response = await apiGet(
          `/api/campaigns?agreementId=${agreementId}&status=active,paused,draft,ended`
        );
        if (cancelled) return;
        const items = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.data)
          ? response.data
          : [];
        setCampaigns(items);
        if (items.length === 0) {
          warn('Convênio ainda não possui campanhas registradas', { agreementId });
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar campanhas');
        }
        warn('Falha ao listar campanhas', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [agreementId, log, warn, open]);

  const renderStatus = (campaign) => {
    const tone =
      statusTone[campaign.status] ||
      'bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)] border-[color:var(--color-inbox-border)]';
    return (
      <Badge variant="outline" className={`border ${tone}`}>
        {campaign.status}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={!agreementId}>
          <History className="mr-2 h-4 w-4" /> Ver campanhas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Campanhas do convênio</DialogTitle>
          <DialogDescription>
            Histórico das campanhas vinculadas ao convênio selecionado para garantir rastreabilidade.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando campanhas...
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {!loading && !errorMessage ? (
            <ScrollArea className="max-h-80">
              <div className="space-y-3 pr-4">
                {campaigns.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-4 text-sm text-muted-foreground">
                    Nenhuma campanha encontrada ainda. Crie uma nova ao confirmar o WhatsApp e voltamos a listar por aqui.
                  </div>
                ) : (
                  campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="glass-surface space-y-2 rounded-[var(--radius)] border border-[color:var(--color-inbox-border)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">{campaign.id}</p>
                        </div>
                        {renderStatus(campaign)}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Instância: {campaign.instanceId || '—'}</span>
                        <span>Lead cap: {campaign.leadCap ?? '—'}</span>
                        {campaign.updatedAt ? (
                          <span>
                            Atualizada em{' '}
                            {new Date(campaign.updatedAt).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignHistoryDialog;
