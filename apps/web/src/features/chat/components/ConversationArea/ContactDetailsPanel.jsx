import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn, formatPhoneNumber } from '@/lib/utils.js';
import { Copy as CopyIcon, Download, Edit3, Phone as PhoneIcon, MessageCircle, Mail, AlertTriangle } from 'lucide-react';
import { useClipboard } from '@/hooks/use-clipboard.js';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateTime } from '../../utils/datetime.js';
import { formatCurrencyField, formatTermField } from '../../utils/deal-fields.js';
import { getTicketIdentity } from '../../utils/ticketIdentity.js';
import { resolveTicketContext } from './utils/ticketMetadata.js';
import {
  summarizeSimulation,
  summarizeProposal,
  summarizeDeal,
  formatCurrency,
  formatTermLabel,
} from './utils/salesSnapshot.js';
import { resolveProposalMessageFromSummary } from './utils/proposalMessage.js';
import emitInboxTelemetry from '../../utils/telemetry.js';

const CHANNEL_PRESENTATION = {
  WHATSAPP: {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    className:
      'border-[color:var(--color-status-whatsapp-border)] bg-[color:var(--color-status-whatsapp-surface)] text-[color:var(--color-status-whatsapp-foreground)]',
  },
  VOICE: {
    id: 'voice',
    label: 'Telefone',
    icon: PhoneIcon,
    className: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
  },
  EMAIL: {
    id: 'email',
    label: 'E-mail',
    icon: Mail,
    className: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
  },
  DEFAULT: {
    id: 'unknown',
    label: 'Canal não identificado',
    icon: MessageCircle,
    className: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
  },
};

const normalizeChannel = (value) => {
  if (!value) return null;

  const normalized = String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase();

  if (!normalized) {
    return null;
  }

  if (normalized === 'PHONE' || normalized === 'TELEFONE' || normalized === 'CALL') {
    return 'VOICE';
  }

  if (normalized === 'E-MAIL' || normalized === 'MAIL') {
    return 'EMAIL';
  }

  if (normalized === 'WA') {
    return 'WHATSAPP';
  }

  return normalized;
};

const resolveChannelInfo = (channel) => {
  const normalized = normalizeChannel(channel);
  return CHANNEL_PRESENTATION[normalized] ?? CHANNEL_PRESENTATION.DEFAULT;
};

const parseDateValue = (value) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const formatRelativeTime = (value) => {
  const date = parseDateValue(value);
  if (!date) {
    return null;
  }

  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  } catch {
    return null;
  }
};

const getLastInteractionTimestamp = (timeline) => {
  if (!timeline) {
    return null;
  }

  const inboundDate = parseDateValue(timeline.lastInboundAt);
  const outboundDate = parseDateValue(timeline.lastOutboundAt);
  const direction = timeline.lastDirection ?? null;

  if (direction === 'INBOUND' && inboundDate) {
    return inboundDate;
  }

  if (direction === 'OUTBOUND' && outboundDate) {
    return outboundDate;
  }

  if (inboundDate && outboundDate) {
    return inboundDate > outboundDate ? inboundDate : outboundDate;
  }

  return inboundDate ?? outboundDate ?? null;
};

const CopyButton = ({ value, label }) => {
  const clipboard = useClipboard();

  const handleCopy = useCallback(() => {
    clipboard.copy(value);
  }, [clipboard, value]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-foreground-muted hover:text-foreground"
          onClick={handleCopy}
        >
          <CopyIcon className="h-4 w-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copiar {label}</TooltipContent>
    </Tooltip>
  );
};

const useInlineEditor = (initialValue, onSave, debounceMs = 500) => {
  const [draft, setDraft] = useState(initialValue ?? '');
  const [status, setStatus] = useState('idle');
  const timeoutRef = useRef(null);

  useEffect(() => {
    setDraft(initialValue ?? '');
  }, [initialValue]);

  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleChange = useCallback(
    (event) => {
      const nextValue = event.target.value;
      setDraft(nextValue);

      if (!onSave) {
        return;
      }

      setStatus('saving');
      clearTimeoutRef();

      timeoutRef.current = setTimeout(async () => {
        try {
          await onSave(nextValue);
          setStatus('saved');
        } catch {
          setStatus('error');
        } finally {
          timeoutRef.current = null;
        }
      }, debounceMs);
    },
    [clearTimeoutRef, debounceMs, onSave],
  );

  useEffect(() => () => clearTimeoutRef(), [clearTimeoutRef]);

  return { draft, status, handleChange };
};

const InlineField = ({
  label,
  value,
  placeholder,
  onSave,
  formatter,
  copyable = false,
  type = 'text',
  disabled = false,
}) => {
  const { draft, status, handleChange } = useInlineEditor(value ?? '', onSave);
  const labelId = useId();
  const formattedValue = formatter ? formatter(draft) : draft;

  return (
    <div className="flex flex-col gap-1" role="group" aria-labelledby={labelId}>
      <div className="flex items-center justify-between gap-2">
        <span id={labelId} className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
          {label}
        </span>
        {status === 'saving' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600">salvando…</span>
        ) : null}
        {status === 'saved' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">salvo</span>
        ) : null}
        {status === 'error' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-destructive">erro</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={formattedValue}
          onChange={handleChange}
          placeholder={placeholder}
          type={type}
          disabled={disabled || !onSave}
          className={cn(
            'h-9 flex-1 rounded-lg border-surface-overlay-glass-border bg-transparent text-sm',
            status === 'error' && 'border-destructive focus-visible:ring-destructive',
          )}
        />
        {copyable ? <CopyButton value={draft} label={label.toLowerCase()} /> : null}
      </div>
    </div>
  );
};

const NextStepEditor = forwardRef(({ value, onSave }, ref) => {
  const { draft, status, handleChange } = useInlineEditor(value ?? '', onSave, 700);
  const textareaRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        const node = textareaRef.current;
        if (!node || typeof node.focus !== 'function') {
          return false;
        }
        node.focus();
        if (typeof node.setSelectionRange === 'function') {
          const length = node.value?.length ?? 0;
          node.setSelectionRange(length, length);
        }
        return true;
      },
    }),
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Próximo passo</span>
        {status === 'saving' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600">salvando…</span>
        ) : null}
        {status === 'saved' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">salvo</span>
        ) : null}
        {status === 'error' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-destructive">erro</span>
        ) : null}
      </div>
      <Textarea
        ref={textareaRef}
        value={draft}
        onChange={handleChange}
        placeholder="Descreva o próximo passo combinado"
        className={cn(
          'min-h-[90px] rounded-xl border-surface-overlay-glass-border bg-transparent text-sm',
          status === 'error' && 'border-destructive focus-visible:ring-destructive',
        )}
      />
    </div>
  );
});

NextStepEditor.displayName = 'NextStepEditor';

const ContactSummary = ({ ticket }) => {
  const timeline = ticket?.timeline ?? {};
  const lastInbound = timeline.lastInboundAt ? formatDateTime(timeline.lastInboundAt) : '—';
  const lastOutbound = timeline.lastOutboundAt ? formatDateTime(timeline.lastOutboundAt) : '—';
  const lastDirection = timeline.lastDirection ?? null;
  const lastChannel =
    timeline.lastChannel ??
    timeline.lastMessageChannel ??
    (lastDirection === 'INBOUND' ? timeline.lastInboundChannel : timeline.lastOutboundChannel) ??
    timeline.lastInboundChannel ??
    timeline.lastOutboundChannel ??
    timeline.channel ??
    ticket?.channel ??
    ticket?.metadata?.lastChannel ??
    null;

  const channelInfo = useMemo(() => resolveChannelInfo(lastChannel), [lastChannel]);

  const lastInteractionDate = useMemo(
    () => getLastInteractionTimestamp(timeline),
    [timeline.lastDirection, timeline.lastInboundAt, timeline.lastOutboundAt],
  );

  const relativeTime = useMemo(() => formatRelativeTime(lastInteractionDate), [lastInteractionDate]);

  const directionActor = useMemo(() => {
    if (lastDirection === 'INBOUND') {
      return 'Cliente';
    }
    if (lastDirection === 'OUTBOUND') {
      return 'Equipe';
    }
    return null;
  }, [lastDirection]);

  const directionLabel = useMemo(() => {
    switch (lastDirection) {
      case 'INBOUND':
        return 'Cliente aguardando resposta';
      case 'OUTBOUND':
        return 'Aguardando cliente';
      default:
        return 'Sem interações recentes';
    }
  }, [lastDirection]);

  const directionSummary = useMemo(() => {
    if (directionActor && relativeTime) {
      return `${directionActor} • ${relativeTime}`;
    }

    if (directionActor) {
      return directionActor;
    }

    if (relativeTime) {
      return relativeTime;
    }

    return 'Sem interações registradas';
  }, [directionActor, relativeTime]);

  const ChannelIcon = channelInfo.icon;

  return (
    <div className="grid gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Última interação</span>
        <div className="flex flex-wrap items-center gap-2 text-foreground">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
              channelInfo.className,
            )}
          >
            <ChannelIcon className="h-3.5 w-3.5" aria-hidden data-testid={`channel-icon-${channelInfo.id}`} />
            {channelInfo.label}
          </span>
          <span className="text-sm text-foreground">{directionLabel}</span>
        </div>
        <span className="text-xs text-foreground-muted">{directionSummary}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground-muted uppercase tracking-wide">Cliente</span>
          <span className="text-sm text-foreground">{lastInbound}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground-muted uppercase tracking-wide">Equipe</span>
          <span className="text-sm text-foreground">{lastOutbound}</span>
        </div>
      </div>
    </div>
  );
};

const DEAL_STAGE_KEYS = new Set(['LIQUIDACAO', 'APROVADO_LIQUIDACAO']);

const ContactDetailsPanel = ({
  ticket,
  onContactFieldSave,
  onEditContact,
  onCall,
  onSendSms,
  nextStepValue,
  onNextStepSave,
  nextStepEditorRef,
  stageKey,
  onDealFieldSave,
  contextSectionRef = null,
  onOpenSimulation,
  onOpenProposal,
  onOpenDeal,
  salesActionsDisabled = false,
  salesDisabledReason = null,
  salesJourney = null,
}) => {
  const clipboard = useClipboard();
  const identity = useMemo(() => getTicketIdentity(ticket), [ticket]);
  const document = ticket?.contact?.document ?? null;
  const email = ticket?.contact?.email ?? ticket?.metadata?.contactEmail ?? null;
  const rawPhone = identity.rawPhone ?? ticket?.contact?.phone ?? ticket?.metadata?.contactPhone ?? null;
  const displayName = ticket?.contact?.name ?? identity.displayName ?? '';

  const shouldShowDealPanel = DEAL_STAGE_KEYS.has(stageKey);

  const showSalesActions = Boolean(onOpenSimulation || onOpenProposal || onOpenDeal);

  const simulationSnapshot = salesJourney?.events?.simulation?.calculationSnapshot ?? null;
  const proposalSnapshot = salesJourney?.events?.proposal?.calculationSnapshot ?? null;
  const dealSnapshot = salesJourney?.events?.deal?.calculationSnapshot ?? null;

  const simulationSummary = useMemo(
    () => summarizeSimulation(simulationSnapshot),
    [simulationSnapshot],
  );
  const proposalSummary = useMemo(
    () => summarizeProposal(proposalSnapshot),
    [proposalSnapshot],
  );
  const dealSummary = useMemo(() => summarizeDeal(dealSnapshot), [dealSnapshot]);

  const ticketId = ticket?.id ?? null;

  const proposalMessage = useMemo(
    () => resolveProposalMessageFromSummary(proposalSummary),
    [proposalSummary],
  );
  const hasProposalMessage = proposalMessage.trim().length > 0;
  const proposalPdfUrl =
    typeof proposalSummary?.pdf?.url === 'string' ? proposalSummary.pdf.url.trim() : '';
  const proposalPdfFileName = proposalSummary?.pdf?.fileName ?? null;
  const hasProposalPdf = proposalPdfUrl.length > 0;

  const nextActionLabel = salesJourney?.nextAction?.label ?? 'Simular proposta';
  const nextActionDisabled = Boolean(salesJourney?.nextAction?.disabled);

  const dealFields = useMemo(() => {
    if (!shouldShowDealPanel) {
      return {};
    }

    const leadDeal =
      ticket?.lead?.customFields?.deal && typeof ticket.lead.customFields.deal === 'object'
        ? ticket.lead.customFields.deal
        : null;
    const metadataDeal =
      ticket?.metadata?.deal && typeof ticket.metadata.deal === 'object'
        ? ticket.metadata.deal
        : null;

    return leadDeal ?? metadataDeal ?? {};
  }, [shouldShowDealPanel, ticket?.lead?.customFields?.deal, ticket?.metadata?.deal]);

  const attachments = useMemo(() => {
    const source = ticket?.metadata?.attachments ?? ticket?.attachments ?? null;
    if (Array.isArray(source)) return source.filter(Boolean);
    if (source && typeof source === 'object') return Object.values(source).filter(Boolean);
    return [];
  }, [ticket?.attachments, ticket?.metadata?.attachments]);

  const contextSectionTitleId = useId();

  const handleCopyProposalMessage = useCallback(() => {
    if (!hasProposalMessage) {
      return;
    }

    Promise.resolve(clipboard.copy(proposalMessage))
      .then((copied) => {
        emitInboxTelemetry('chat.sales.proposal.copy_message', {
          ticketId,
          source: 'contact-details-panel',
          copied: Boolean(copied),
          length: proposalMessage.length,
        });
      })
      .catch(() => {
        emitInboxTelemetry('chat.sales.proposal.copy_message', {
          ticketId,
          source: 'contact-details-panel',
          copied: false,
          length: proposalMessage.length,
        });
      });
  }, [clipboard, hasProposalMessage, proposalMessage, ticketId]);

  const handleDownloadProposalPdf = useCallback(() => {
    if (!hasProposalPdf) {
      return;
    }

    emitInboxTelemetry('chat.sales.proposal.download_pdf', {
      ticketId,
      source: 'contact-details-panel',
      fileName: proposalPdfFileName ?? null,
    });

    if (typeof window !== 'undefined') {
      window.open(proposalPdfUrl, '_blank', 'noopener,noreferrer');
    }
  }, [hasProposalPdf, proposalPdfFileName, proposalPdfUrl, ticketId]);

  const describeOfferTerms = (offer) => {
    const preferred = offer?.terms?.filter((term) => term.selected) ?? [];
    const base = preferred.length > 0 ? preferred : offer?.terms ?? [];
    return base
      .map((term) => {
        const termLabel = formatTermLabel(term.term, { fallback: null });
        const installmentLabel = formatCurrency(term.installment, { fallback: null });
        const netLabel = formatCurrency(term.netAmount, { fallback: null });
        if (!termLabel && !installmentLabel && !netLabel) {
          return null;
        }
        const pieces = [];
        if (termLabel) {
          pieces.push(termLabel);
        }
        if (installmentLabel) {
          pieces.push(`parcela ${installmentLabel}`);
        }
        if (netLabel) {
          pieces.push(`líquido ${netLabel}`);
        }
        return pieces.join(' · ');
      })
      .filter(Boolean);
  };

  const contextItems = useMemo(() => {
    const { instance, campaignId, campaignName, productType, strategy } = resolveTicketContext(ticket);

    const instanceLabel = instance ?? 'Instância desconhecida';
    const campaignLabel = campaignName ?? campaignId ?? 'Não informada';
    const productLabel = productType ?? 'Não informado';
    const strategyLabel = strategy ?? 'Não informada';

    return [
      { id: 'instance', label: 'Instância', value: instanceLabel },
      { id: 'campaign', label: 'Campanha', value: campaignLabel },
      { id: 'productType', label: 'Convênio', value: productLabel },
      { id: 'strategy', label: 'Estratégia', value: strategyLabel },
    ];
  }, [ticket]);

  return (
    <div className="flex w-full flex-col gap-4">
      {salesJourney ? (
        <div className="flex w-full flex-col gap-3 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Próximo passo sugerido</p>
              <p className="text-sm font-semibold text-foreground">{nextActionLabel}</p>
              {nextActionDisabled ? (
                <p className="text-xs text-foreground-muted">Contrato concluído. Acompanhe pelo histórico.</p>
              ) : null}
            </div>
            {salesJourney.stageLabel ? (
              <span className="inline-flex items-center rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                {salesJourney.stageLabel}
              </span>
            ) : null}
          </div>
          {simulationSummary ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Última simulação</p>
              <div className="space-y-2">
                {simulationSummary.offers
                  .map((offer) => {
                    const descriptions = describeOfferTerms(offer);
                    if (descriptions.length === 0) {
                      return null;
                    }
                    return (
                      <div
                        key={`simulation-${offer.id}`}
                        className="rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet p-3 text-xs text-foreground"
                      >
                        <p className="font-semibold text-foreground">{offer.bankName}</p>
                        {offer.table ? <p className="text-foreground-muted">{offer.table}</p> : null}
                        <ul className="mt-1 space-y-1 text-foreground-muted">
                          {descriptions.map((description, index) => (
                            <li key={`${offer.id}-term-${index}`}>{description}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })
                  .filter(Boolean)}
              </div>
            </div>
          ) : null}
          {proposalSummary?.selected?.length ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Última proposta</p>
              <ul className="space-y-1 text-xs text-foreground-muted">
                {proposalSummary.selected.map((entry) => (
                  <li key={`proposal-${entry.offerId}-${entry.term.id}`}>
                    <span className="font-semibold text-foreground">{entry.bankName}</span> · {formatTermLabel(entry.term.term)} · {formatCurrency(entry.term.installment)} (líquido {formatCurrency(entry.term.netAmount)})
                  </li>
                ))}
              </ul>
              {proposalSummary.pdf?.fileName ? (
                <p className="text-[11px] uppercase tracking-wide text-foreground-muted">
                  PDF: {proposalSummary.pdf.fileName}
                </p>
              ) : null}
            </div>
          ) : null}
          {proposalSummary ? (
            <div className="space-y-3 rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Proposta pronta</p>
                  <p className="text-xs text-foreground-muted">Mensagem sugerida para seguir a conversa com o cliente.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={handleCopyProposalMessage} disabled={!hasProposalMessage}>
                    <CopyIcon className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Copiar mensagem
                  </Button>
                  {hasProposalPdf ? (
                    <Button type="button" size="sm" variant="secondary" onClick={handleDownloadProposalPdf}>
                      <Download className="mr-2 h-3.5 w-3.5" aria-hidden />
                      Baixar PDF
                    </Button>
                  ) : null}
                </div>
              </div>
              {hasProposalMessage ? (
                <Textarea value={proposalMessage} readOnly rows={5} className="text-sm" />
              ) : (
                <p className="text-xs text-foreground-muted">Nenhuma mensagem disponível para esta proposta.</p>
              )}
              {proposalPdfFileName ? (
                <p className="text-[11px] uppercase tracking-wide text-foreground-muted">Arquivo: {proposalPdfFileName}</p>
              ) : null}
            </div>
          ) : null}
          {dealSummary && (dealSummary.bank?.label || dealSummary.term || dealSummary.installment) ? (
            <div className="space-y-1 text-xs text-foreground">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Último deal registrado</p>
              <p>
                {dealSummary.bank?.label ?? 'Banco não informado'} · {formatTermLabel(dealSummary.term)} · {formatCurrency(dealSummary.installment)} (líquido {formatCurrency(dealSummary.netAmount)})
              </p>
              {dealSummary.closedAt ? (
                <p className="text-foreground-muted">Fechado em {formatDateTime(dealSummary.closedAt)}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex w-full flex-col gap-4 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4">
        <h4 className="text-sm font-semibold text-foreground">Contato</h4>
        <InlineField
          label="Nome"
          value={displayName}
          placeholder="Nome completo"
          onSave={onContactFieldSave ? (value) => onContactFieldSave('name', value) : undefined}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <InlineField
            label="Telefone"
            value={rawPhone ?? ''}
            placeholder="(00) 00000-0000"
            onSave={onContactFieldSave ? (value) => onContactFieldSave('phone', value) : undefined}
            formatter={formatPhoneNumber}
            copyable
          />
          <InlineField
            label="Documento"
            value={document ?? ''}
            placeholder="000.000.000-00"
            onSave={onContactFieldSave ? (value) => onContactFieldSave('document', value) : undefined}
            copyable
          />
          <InlineField
            label="E-mail"
            value={email ?? ''}
            placeholder="nome@exemplo.com"
            onSave={onContactFieldSave ? (value) => onContactFieldSave('email', value) : undefined}
            type="email"
            copyable
          />
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Ações de contato</span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onCall}>
                <PhoneIcon className="mr-2 h-3.5 w-3.5" aria-hidden />
                Ligar agora
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onSendSms}>
                Enviar SMS
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEditContact?.(ticket?.contact?.id ?? null)}
              >
                <Edit3 className="mr-2 h-3.5 w-3.5" aria-hidden />
                Editar contato
              </Button>
            </div>
          </div>
        {showSalesActions ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Operações de vendas
            </span>
            <div className="flex flex-wrap gap-2">
              {onOpenSimulation ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenSimulation}
                  disabled={salesActionsDisabled}
                >
                  Registrar simulação
                </Button>
              ) : null}
              {onOpenProposal ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenProposal}
                  disabled={salesActionsDisabled}
                >
                  Gerar proposta
                </Button>
              ) : null}
              {onOpenDeal ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onOpenDeal}
                  disabled={salesActionsDisabled}
                >
                  Registrar deal
                </Button>
              ) : null}
            </div>
            {salesActionsDisabled && salesDisabledReason ? (
              <p className="text-xs text-warning-strong">{salesDisabledReason}</p>
            ) : null}
          </div>
        ) : null}
      </div>
      <ContactSummary ticket={ticket} />
      <NextStepEditor ref={nextStepEditorRef} value={nextStepValue} onSave={onNextStepSave} />
    </div>
    <div
        ref={contextSectionRef}
        tabIndex={-1}
        className="flex w-full flex-col gap-3 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]"
        aria-labelledby={contextSectionTitleId}
      >
        <h4 id={contextSectionTitleId} className="text-sm font-semibold text-foreground">
          Contexto do lead
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {contextItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">{item.label}</span>
              <span className="text-sm text-foreground" title={item.value}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
      {shouldShowDealPanel ? (
        <div className="w-full rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Liquidação</h4>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InlineField
              label="Parcela"
              value={dealFields?.installmentValue ?? ''}
              placeholder="R$ 0,00"
              formatter={formatCurrencyField}
              onSave={onDealFieldSave ? (value) => onDealFieldSave('installmentValue', value) : undefined}
            />
            <InlineField
              label="Líquido"
              value={dealFields?.netValue ?? ''}
              placeholder="R$ 0,00"
              formatter={formatCurrencyField}
              onSave={onDealFieldSave ? (value) => onDealFieldSave('netValue', value) : undefined}
            />
            <InlineField
              label="Prazo"
              value={dealFields?.term ?? ''}
              placeholder="12 meses"
              formatter={formatTermField}
              onSave={onDealFieldSave ? (value) => onDealFieldSave('term', value) : undefined}
            />
            <InlineField
              label="Produto"
              value={dealFields?.product ?? ''}
              placeholder="Produto contratado"
              onSave={onDealFieldSave ? (value) => onDealFieldSave('product', value) : undefined}
            />
            <InlineField
              label="Banco"
              value={dealFields?.bank ?? ''}
              placeholder="Banco parceiro"
              onSave={onDealFieldSave ? (value) => onDealFieldSave('bank', value) : undefined}
            />
          </div>
        </div>
      ) : null}
      <div className="w-full rounded-2xl border border-dashed border-surface-overlay-glass-border bg-surface-overlay-quiet/60 p-4 text-xs text-foreground-muted">
        <div className="flex items-center gap-2 text-foreground">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <span className="font-semibold">Anexos recentes</span>
        </div>
        {attachments.length ? (
          <ul className="mt-2 space-y-2">
            {attachments.slice(0, 5).map((item, index) => {
              const key = item?.id ?? item?.name ?? item?.fileName ?? item?.url ?? index;
              const label = item?.name ?? item?.fileName ?? item?.filename ?? item?.originalName ?? 'Anexo';
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 py-2 text-sm text-foreground"
                >
                  <span className="min-w-0 flex-1 truncate [overflow-wrap:anywhere]">{label}</span>
                  <span className="text-xs text-foreground-muted">
                    {item?.size ? `${Math.round(item.size / 1024)} KB` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm">Nenhum anexo disponível para este ticket.</p>
        )}
      </div>
    </div>
  );
};

export default ContactDetailsPanel;
