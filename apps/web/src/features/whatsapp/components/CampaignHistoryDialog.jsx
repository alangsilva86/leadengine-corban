import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge.jsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';

import { fetchCampaigns } from '../connect/services/campaignService';
import { resolveWhatsAppError } from '../lib/errors';
import { formatTimestampLabel } from '../lib/formatting';
import { statusMeta } from '../utils/campaign-helpers.js';

const STATUS_BADGE = { active: 'success', paused: 'warning', draft: 'secondary', ended: 'secondary', archived: 'secondary' };
const ALL_STATUSES = ['active', 'paused', 'draft', 'ended'];

/**
 * Histórico das regras de uma origem (convênio ou parceiro), inclusive as encerradas.
 * Controlado pela página: abre a partir do menu "⋯" do cartão.
 */
const CampaignHistoryDialog = ({ open, onOpenChange, campaign, numbersById }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const agreementId = campaign?.agreementId ?? null;
  const originLabel = campaign?.agreementName || 'esta origem';

  useEffect(() => {
    if (!open || !agreementId) {
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    fetchCampaigns({ agreementId, statuses: ALL_STATUSES })
      .then((list) => {
        if (cancelled) return;
        const sorted = [...list].sort(
          (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
        );
        setItems(sorted);
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(resolveWhatsAppError(error, 'Não foi possível carregar o histórico').message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agreementId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico de {originLabel}</DialogTitle>
          <DialogDescription>Todas as regras desta origem, inclusive as encerradas.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Carregando histórico…
          </div>
        ) : errorMessage ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
            {errorMessage}
          </p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma regra encontrada para esta origem.</p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y divide-border pr-3">
              {items.map((item) => {
                const numberName = item.instanceId
                  ? numbersById?.get(item.instanceId)?.name ?? item.instanceName ?? 'Número removido'
                  : 'Sem número';
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {numberName}
                        {item.updatedAt ? ` · atualizada em ${formatTimestampLabel(item.updatedAt)}` : ''}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[item.status] ?? 'secondary'} className="shrink-0">
                      {statusMeta[item.status]?.label ?? 'Rascunho'}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CampaignHistoryDialog;
