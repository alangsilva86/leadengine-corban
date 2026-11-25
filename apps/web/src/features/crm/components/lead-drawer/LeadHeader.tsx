import type { ReactNode } from 'react';
import type { LeadDetail } from '../../state/leads';
import {
  formatDateTime,
  getSourceIcon,
  getSourceLabel,
  IDLE_TONE_CLASS,
  getIdleTone,
} from '../../utils/labels';
import { formatPhone } from '@/lib/phone';
import { formatBRL } from '@/lib/currency';
import { formatRelativeShort } from '@/lib/relative-time';

type LeadHeaderProps = {
  lead: LeadDetail;
  /** Dados do contato (telefone/e-mail) quando disponíveis. */
  contact?: { phone?: string | null; email?: string | null } | null;
};

const Item = ({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) => (
  <div className={wide ? 'col-span-2 min-w-0 space-y-0.5' : 'min-w-0 space-y-0.5'}>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="truncate text-sm text-foreground">{children}</dd>
  </div>
);

/** Dados do lead no painel lateral. Só mostra o que a API informa (sem "Sem e-mail" com link vazio). */
const LeadHeader = ({ lead, contact }: LeadHeaderProps) => {
  const sourceLabel = getSourceLabel(lead.source);
  const SourceIcon = getSourceIcon(lead.source);
  const value = formatBRL(lead.potentialValue);
  const phone = formatPhone(contact?.phone ?? lead.phone);
  const email = contact?.email ?? lead.email ?? null;
  const relative = formatRelativeShort(lead.lastActivityAt);

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Item label="Valor potencial">
        {value ? <span className="tabular-nums">{value}</span> : <span className="text-muted-foreground">Não informado</span>}
      </Item>
      <Item label="Responsável">
        {lead.ownerName ?? <span className="text-muted-foreground">Sem responsável</span>}
      </Item>
      <Item label="Origem">
        {sourceLabel ? (
          <span className="inline-flex items-center gap-1">
            <SourceIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {sourceLabel}
          </span>
        ) : (
          <span className="text-muted-foreground">Não informada</span>
        )}
      </Item>
      <Item label="Última atividade">
        {relative ? (
          <span className={IDLE_TONE_CLASS[getIdleTone(lead.lastActivityAt)]} title={formatDateTime(lead.lastActivityAt) ?? undefined}>
            {relative}
          </span>
        ) : (
          <span className="text-muted-foreground">Sem atividade</span>
        )}
      </Item>
      {phone ? (
        <Item label="WhatsApp">
          <a href={`tel:${contact?.phone ?? lead.phone}`} className="tabular-nums hover:underline">
            {phone}
          </a>
        </Item>
      ) : null}
      {email ? (
        <Item label="E-mail" wide>
          <a href={`mailto:${email}`} className="hover:underline">
            {email}
          </a>
        </Item>
      ) : null}
      {lead.notes ? (
        <div className="col-span-2 space-y-0.5">
          <dt className="text-xs text-muted-foreground">Observações</dt>
          <dd className="whitespace-pre-line text-sm text-foreground">{lead.notes}</dd>
        </div>
      ) : null}
    </dl>
  );
};

export default LeadHeader;
