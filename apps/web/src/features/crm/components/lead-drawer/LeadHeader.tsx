import { Building2, Mail, Phone, User, Workflow, CalendarClock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import LeadHealthBadge from './LeadHealthBadge.tsx';
import type { LeadDetail } from '../../state/leads.ts';

type LeadHeaderProps = {
  lead: LeadDetail;
};

const formatRelativeTime = (value: string | null | undefined) => {
  if (!value) {
    return 'Sem atividade recente';
  }
  try {
    return `Última atividade ${formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR })}`;
  } catch {
    return 'Última atividade indisponível';
  }
};

const LeadHeader = ({ lead }: LeadHeaderProps) => {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Workflow className="h-4 w-4" />
            <span>{lead.stage ?? 'Etapa desconhecida'}</span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">{lead.name}</h2>
          <p className="text-sm text-muted-foreground">{formatRelativeTime(lead.lastActivityAt)}</p>
        </div>
        <LeadHealthBadge status={lead.health ?? undefined} />
      </div>

      <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground sm:grid-cols-2">
        <span className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Responsável: <strong className="text-foreground">{lead.ownerName ?? 'Não atribuído'}</strong>
        </span>
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Empresa: <strong className="text-foreground">{lead.company ?? 'Não informado'}</strong>
        </span>
        <span className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          <a href={lead.email ? `mailto:${lead.email}` : '#'} className="text-primary hover:underline">
            {lead.email ?? 'Sem e-mail'}
          </a>
        </span>
        <span className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          <a href={lead.phone ? `tel:${lead.phone}` : '#'} className="text-primary hover:underline">
            {lead.phone ?? 'Sem telefone'}
          </a>
        </span>
        <span className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          Canal: <strong className="text-foreground">{lead.channel ?? 'Desconhecido'}</strong>
        </span>
      </div>
    </section>
  );
};

export default LeadHeader;
