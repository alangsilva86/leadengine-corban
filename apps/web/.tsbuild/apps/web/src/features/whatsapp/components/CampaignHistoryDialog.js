import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { apiGet } from '@/lib/api.js';
import { Loader2, History } from 'lucide-react';
import usePlayfulLogger from '../../shared/usePlayfulLogger.js';
import { getCampaignStatusTone, statusMeta } from '../utils/campaign-helpers.js';
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
                const response = await apiGet(`/api/campaigns?agreementId=${agreementId}&status=active,paused,draft,ended`);
                if (cancelled)
                    return;
                const items = Array.isArray(response?.items)
                    ? response.items
                    : Array.isArray(response?.data)
                        ? response.data
                        : [];
                setCampaigns(items);
                if (items.length === 0) {
                    warn('Origem ainda não possui campanhas registradas', { agreementId });
                }
            }
            catch (error) {
                if (!cancelled) {
                    setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar campanhas');
                }
                warn('Falha ao listar campanhas', error);
            }
            finally {
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
        const tone = getCampaignStatusTone(campaign.status);
        const label = statusMeta[campaign.status]?.label ?? campaign.status;
        return (_jsx(Badge, { variant: "status", tone: tone, className: "gap-2 text-[0.65rem] font-semibold uppercase", children: label }));
    };
    return (_jsxs(Dialog, { open: open, onOpenChange: setOpen, children: [_jsx(DialogTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "sm", disabled: !agreementId, children: [_jsx(History, { className: "mr-2 h-4 w-4" }), " Ver campanhas"] }) }), _jsxs(DialogContent, { className: "max-w-xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Campanhas da origem" }), _jsx(DialogDescription, { children: "Hist\u00F3rico das campanhas vinculadas \u00E0 origem selecionada (conv\u00EAnio, parceiro ou carteira) para garantir rastreabilidade." })] }), _jsxs("div", { className: "space-y-4", children: [loading ? (_jsxs("div", { className: "flex items-center justify-center py-6 text-muted-foreground", children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), " Carregando campanhas..."] })) : null, errorMessage ? (_jsx("div", { className: "rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive", children: errorMessage })) : null, !loading && !errorMessage ? (_jsx(ScrollArea, { className: "max-h-80", children: _jsx("div", { className: "space-y-3 pr-4", children: campaigns.length === 0 ? (_jsx("div", { className: "rounded-lg border border-dashed border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-4 text-sm text-muted-foreground", children: "Nenhuma campanha encontrada ainda. Crie uma nova ao confirmar o WhatsApp e voltamos a listar por aqui." })) : (campaigns.map((campaign) => (_jsxs("div", { className: "glass-surface space-y-2 rounded-[var(--radius)] border border-[color:var(--color-inbox-border)] p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: campaign.name }), _jsx("p", { className: "text-xs text-muted-foreground", children: campaign.id })] }), renderStatus(campaign)] }), _jsxs("div", { className: "flex flex-wrap gap-3 text-xs text-muted-foreground", children: [_jsxs("span", { children: ["Inst\u00E2ncia: ", campaign.instanceId || '—'] }), _jsxs("span", { children: ["Lead cap: ", campaign.leadCap ?? '—'] }), campaign.updatedAt ? (_jsxs("span", { children: ["Atualizada em", ' ', new Date(campaign.updatedAt).toLocaleString('pt-BR', {
                                                                dateStyle: 'short',
                                                                timeStyle: 'short',
                                                            })] })) : null] })] }, campaign.id)))) }) })) : null] })] })] }));
};
export default CampaignHistoryDialog;
