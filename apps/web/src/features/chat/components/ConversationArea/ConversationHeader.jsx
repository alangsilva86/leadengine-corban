import { Button } from '@/components/ui/button.jsx';
import StatusBadge from '../Shared/StatusBadge.jsx';
import PipelineStepTag from '../Shared/PipelineStepTag.jsx';
import SlaBadge from '../SidebarInbox/SlaBadge.jsx';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { formatPhoneNumber, buildInitials } from '@/lib/utils.js';

export const ConversationHeader = ({
  ticket,
  onMarkWon,
  onMarkLost,
  onAssign,
  onGenerateProposal,
  typingAgents = [],
}) => {
  if (!ticket) {
    return (
      <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-slate-800/60 bg-slate-950/70 text-sm text-slate-400">
        Selecione um ticket para visualizar a conversa.
      </div>
    );
  }

  const name = ticket.contact?.name ?? ticket.subject ?? 'Contato sem nome';
  const phone = formatPhoneNumber(ticket.contact?.phone || ticket?.metadata?.contactPhone);
  const document = ticket.contact?.document ?? '—';
  const remoteJid = ticket?.metadata?.whatsapp?.remoteJid || ticket?.metadata?.remoteJid || null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800/60 bg-slate-950/70 px-4 py-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-100">
          <span>{name}</span>
          <StatusBadge status={ticket.status} />
          <PipelineStepTag step={ticket.pipelineStep ?? ticket.metadata?.pipelineStep} />
          <SlaBadge window={ticket.window} />
        </div>
        <div className="text-xs text-slate-400">
          Lead #{ticket.lead?.id ?? '—'} · Valor potencial {ticket.lead?.value ? `R$ ${ticket.lead.value}` : '—'} · Probabilidade {ticket.lead?.probability ?? '—'}%
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {typingAgents.length > 0 ? (
          <div className="flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
            <div className="flex -space-x-2">
              {typingAgents.slice(0, 3).map((agent) => (
                <Avatar key={agent.userId} className="h-6 w-6 border border-slate-900">
                  <AvatarFallback>{buildInitials(agent.userName, 'AG')}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span>{typingAgents[0].userName ?? 'Agente'} digitando…</span>
          </div>
        ) : null}
        <Button size="sm" variant="secondary" onClick={() => onAssign?.(ticket)}>
          Atribuir
        </Button>
        <Button size="sm" variant="outline" onClick={() => onGenerateProposal?.(ticket)}>
          Gerar proposta
        </Button>
        <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => onMarkWon?.(ticket)}>
          Ganho
        </Button>
        <Button size="sm" variant="outline" className="border-rose-500/60 text-rose-200 hover:bg-rose-500/10" onClick={() => onMarkLost?.(ticket)}>
          Perda
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Badge variant="outline" className="border-slate-800/60 bg-slate-900/60 text-[11px] text-slate-200">
          {phone}
        </Badge>
        <Badge variant="outline" className="border-slate-800/60 bg-slate-900/60 text-[11px] text-slate-200">
          Documento: {document}
        </Badge>
        {remoteJid ? (
          <Badge variant="outline" className="border-slate-800/60 bg-slate-900/60 text-[11px] text-slate-300">
            {remoteJid}
          </Badge>
        ) : null}
      </div>
    </div>
  );
};

export default ConversationHeader;
