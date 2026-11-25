import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, Lock, Mail, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { formatBRL } from '@/lib/currency';
import LeadStageBadge from '@/features/crm/components/lead-stage/LeadStageBadge';
import {
  CONTACT_STATUS_LABELS,
  documentKindLabel,
  formatDocument,
  humanizeFieldKey,
} from '../utils/format.js';
import { formatPhone } from '@/lib/phone';

const Field = ({ label, children }) => (
  <div className="space-y-0.5">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm text-foreground">{children}</dd>
  </div>
);

const CopyButton = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          aria-label={`Copiar ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copiado' : `Copiar ${label}`}</TooltipContent>
    </Tooltip>
  );
};

const formatCustomValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') return null;
  return String(value);
};

/**
 * Identidade do contato (coluna esquerda do detalhe).
 * CPF sempre mascarado; só quem tem `canViewSensitiveData` pode revelar.
 */
const ContactSummary = ({ contact, lead = null, isLoading = false, canViewSensitiveData = false }) => {
  const [revealDocument, setRevealDocument] = useState(false);

  if (isLoading || !contact) {
    return (
      <section className="space-y-4 rounded-lg border border-border bg-surface p-4" aria-busy="true">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </section>
    );
  }

  const phone = formatPhone(contact.phone);
  const tags = Array.isArray(contact.tags) ? contact.tags.filter(Boolean) : [];
  const customFields = Object.entries(contact.customFields && typeof contact.customFields === 'object' ? contact.customFields : {})
    .map(([key, value]) => [humanizeFieldKey(key), formatCustomValue(value)])
    .filter(([key, value]) => key && value);
  const documentLabel = documentKindLabel(contact.document);
  const documentValue = formatDocument(contact.document, { reveal: canViewSensitiveData && revealDocument });
  const statusLabel = contact.status && contact.status !== 'ACTIVE' ? CONTACT_STATUS_LABELS[contact.status] : null;

  return (
    <section aria-labelledby="contact-summary-title" className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <h2 id="contact-summary-title" className="text-sm font-medium text-foreground">
        Dados do contato
      </h2>
      {statusLabel || contact.isBlocked ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {statusLabel ? <Badge variant="secondary">{statusLabel}</Badge> : null}
          {contact.isBlocked ? <Badge variant="destructive">Bloqueado</Badge> : null}
        </div>
      ) : null}

      <dl className="space-y-3">
        <Field label="WhatsApp">
          {phone ? (
            <span className="flex items-center gap-1">
              <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <a href={`tel:${contact.phone}`} className="tabular-nums no-underline hover:underline">
                {phone}
              </a>
              <CopyButton value={contact.phone} label="telefone" />
            </span>
          ) : (
            <span className="text-muted-foreground">Sem telefone</span>
          )}
        </Field>
        <Field label="E-mail">
          {contact.email ? (
            <span className="flex min-w-0 items-center gap-1">
              <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <a href={`mailto:${contact.email}`} className="truncate hover:underline">
                {contact.email}
              </a>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem e-mail</span>
          )}
        </Field>
        <Field label="Lead">
          {lead ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <LeadStageBadge stage={lead.stage} />
              {formatBRL(lead.potentialValue) ? <span className="tabular-nums">{formatBRL(lead.potentialValue)}</span> : null}
              <span className="text-muted-foreground">· {lead.ownerName ?? 'Sem responsável'}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem lead no funil</span>
          )}
        </Field>
        <Field label={documentLabel}>
          {documentValue ? (
            <span className="flex items-center gap-1">
              <span className="tabular-nums">{documentValue}</span>
              {canViewSensitiveData ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground"
                      aria-label={revealDocument ? `Ocultar ${documentLabel}` : `Mostrar ${documentLabel}`}
                      aria-pressed={revealDocument}
                      onClick={() => setRevealDocument((value) => !value)}
                    >
                      {revealDocument ? <EyeOff /> : <Eye />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{revealDocument ? 'Ocultar' : 'Mostrar'}</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex text-muted-foreground" tabIndex={0} aria-label="Dado protegido pela LGPD">
                      <Lock className="size-3.5" aria-hidden="true" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Dado protegido. Só supervisores e administradores veem completo.</TooltipContent>
                </Tooltip>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Não informado</span>
          )}
        </Field>
        <Field label="Tags">
          {tags.length ? (
            <span className="flex flex-wrap gap-1 pt-0.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">Sem tags</span>
          )}
        </Field>
        {customFields.map(([key, value]) => (
          <Field key={key} label={key}>
            {value}
          </Field>
        ))}
      </dl>

      {contact.notes ? (
        <div className="space-y-1 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">Observações</p>
          <p className="whitespace-pre-line text-sm text-foreground">{contact.notes}</p>
        </div>
      ) : null}
    </section>
  );
};

export default ContactSummary;
