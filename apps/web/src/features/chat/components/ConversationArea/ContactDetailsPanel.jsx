import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Copy as CopyIcon, Phone as PhoneIcon, MessageCircle, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { useClipboard } from '@/hooks/use-clipboard.js';
import { cn } from '@/lib/utils.js';

import { formatDateTime } from '../../utils/datetime.js';
import { getTicketIdentity } from '../../utils/ticketIdentity.js';
import { resolveTicketContext } from './utils/ticketMetadata.js';
import { resolveChannelInfo, toSentenceCase } from './utils/presentation.js';
import useInstancePresentation from '../../hooks/useInstancePresentation.js';
import LeadStageBadge from '@/features/crm/components/lead-stage/LeadStageBadge';
import LeadStageMenu, { LeadStageChip } from '@/features/crm/components/lead-stage/LeadStageMenu';
import LeadStageTrack from '@/features/crm/components/lead-stage/LeadStageTrack';
import { LEAD_PIPELINE_STAGES, LEAD_STAGE_DEFINITIONS } from '@/features/crm/utils/lead-stage';
import { formatPhoneNumber } from '@/lib/phone';
import { formatRelativeLong } from '@/lib/relative-time';

const CHANNEL_TONE_CLASSES = {
  whatsapp: 'bg-whatsapp-soft text-whatsapp-soft-foreground',
  voice: 'bg-surface-sunken text-foreground',
  email: 'bg-surface-sunken text-foreground',
  unknown: 'bg-surface-sunken text-muted-foreground',
};

const CHANNEL_ICONS = { whatsapp: MessageCircle, voice: PhoneIcon, email: Mail, unknown: MessageCircle };

const parseDateValue = (value) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
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
          className="text-muted-foreground hover:text-foreground"
          size="icon-xs"
          onClick={handleCopy}
          aria-label={`Copiar ${label}`}
        >
          <CopyIcon className="h-4 w-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copiar {label}</TooltipContent>
    </Tooltip>
  );
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
  const [draft, setDraft] = useState(value ?? '');
  const labelId = useId();

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const formattedValue = formatter ? formatter(draft) : draft;

  const handleBlur = useCallback(async () => {
    if (!onSave) {
      return;
    }
    await onSave(draft);
  }, [draft, onSave]);

  return (
    <div className="flex flex-col gap-1" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Input
          value={formattedValue}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          type={type}
          disabled={disabled}
          aria-labelledby={labelId}
          className="h-9"
        />
        {copyable && draft ? <CopyButton value={draft} label={label} /> : null}
      </div>
    </div>
  );
};

const NextStepEditor = forwardRef(({ value = '', onSave }, elementRef) => {
  const textareaRef = useRef(null);

  useImperativeHandle(
    elementRef,
    () => ({
      focus: () => {
        textareaRef.current?.focus();
        return true;
      },
    }),
    [],
  );

  return (
    <section className="flex w-full flex-col gap-2 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Próximo passo</h3>
        <p className="text-xs text-muted-foreground">O que foi combinado para o próximo contato.</p>
      </div>
      <Textarea
        ref={textareaRef}
        defaultValue={value ?? ''}
        rows={4}
        placeholder="Ex.: confirmar documentação e enviar proposta"
        aria-label="Próximo passo"
        onBlur={(event) => onSave?.(event.target.value)}
      />
    </section>
  );
});

NextStepEditor.displayName = 'NextStepEditor';

/** Etapa do lead (a mesma do CRM): chip que abre "Mover para…", trilho do funil e a descrição. */
const LeadStageSection = ({ stage, onStageChange, pendingStage }) => {
  const titleId = useId();
  if (!stage) return null;
  const definition = LEAD_STAGE_DEFINITIONS[stage];
  const position = definition.exit ? 'Saída do funil' : `Etapa ${definition.order} de ${LEAD_PIPELINE_STAGES.length}`;

  return (
    <section className="flex w-full flex-col gap-2 border-t border-border pt-4" aria-labelledby={titleId}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={titleId} className="text-sm font-semibold text-foreground">
          Etapa do lead
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">{position}</span>
      </div>
      <div className="flex items-center gap-2">
        {typeof onStageChange === 'function' ? (
          <LeadStageMenu stage={stage} onSelect={onStageChange} align="start" label="Mudar etapa do lead">
            <LeadStageChip stage={stage} pending={Boolean(pendingStage)} />
          </LeadStageMenu>
        ) : (
          <LeadStageBadge stage={stage} />
        )}
      </div>
      <LeadStageTrack stage={stage} />
      <p className="text-xs text-muted-foreground">{definition.description}</p>
    </section>
  );
};

const ContactSummary = ({ ticket }) => {
  const timeline = ticket?.timeline ?? ticket?.metadata?.timeline ?? null;
  const lastTimestamp = useMemo(() => getLastInteractionTimestamp(timeline), [timeline]);
  const relativeTime = useMemo(() => formatRelativeLong(lastTimestamp), [lastTimestamp]);
  const directionActor = timeline?.lastDirection ?? null;

  const channel = ticket?.channel ?? ticket?.metadata?.channel ?? ticket?.metadata?.origin ?? null;
  const channelInfo = resolveChannelInfo(channel);
  const ChannelIcon = CHANNEL_ICONS[channelInfo.id] ?? MessageCircle;

  const lastInbound = timeline?.lastInboundAt ? formatDateTime(timeline.lastInboundAt) : '—';
  const lastOutbound = timeline?.lastOutboundAt ? formatDateTime(timeline.lastOutboundAt) : '—';

  const directionLabel =
    directionActor === 'INBOUND' ? 'Cliente' : directionActor === 'OUTBOUND' ? 'Equipe' : 'Sem direção';

  const directionSummary = useMemo(() => {
    if (relativeTime) {
      return relativeTime;
    }
    return 'Sem interações registradas';
  }, [relativeTime]);

  return (
    <section className="grid gap-3 border-t border-border pt-4 text-sm">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Última interação</h3>
        <div className="flex flex-wrap items-center gap-2 text-foreground">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              CHANNEL_TONE_CLASSES[channelInfo.id] ?? CHANNEL_TONE_CLASSES.unknown,
            )}
          >
            <ChannelIcon className="h-3.5 w-3.5" aria-hidden data-testid={`channel-icon-${channelInfo.id}`} />
            {channelInfo.label}
          </span>
          <span className="text-sm text-foreground">{directionLabel}</span>
        </div>
        <span className="text-xs text-muted-foreground">{directionSummary}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-muted-foreground">Cliente escreveu</span>
          <span className="text-sm text-foreground">{lastInbound}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-muted-foreground">Equipe respondeu</span>
          <span className="text-sm text-foreground">{lastOutbound}</span>
        </div>
      </div>
    </section>
  );
};

const ContactDetailsPanel = ({
  ticket,
  onContactFieldSave,
  onCall,
  onSendSms,
  nextStepValue,
  onNextStepSave,
  nextStepEditorRef,
  contextSectionRef = null,
  stage = null,
  onStageChange,
  pendingStage = null,
}) => {
  const identity = useMemo(() => getTicketIdentity(ticket), [ticket]);
  const document = ticket?.contact?.document ?? null;
  const email = ticket?.contact?.email ?? ticket?.metadata?.contactEmail ?? null;
  const rawPhone = identity.rawPhone ?? ticket?.contact?.phone ?? ticket?.metadata?.contactPhone ?? null;
  const displayName = ticket?.contact?.name ?? identity.displayName ?? '';
  const contactId = ticket?.contact?.id ?? ticket?.contactId;

  const attachments = useMemo(() => {
    const source = ticket?.metadata?.attachments ?? ticket?.attachments ?? null;
    if (Array.isArray(source)) return source.filter(Boolean);
    if (source && typeof source === 'object') return Object.values(source).filter(Boolean);
    return [];
  }, [ticket?.attachments, ticket?.metadata?.attachments]);

  const contextSectionTitleId = useId();
  const ticketContext = useMemo(() => resolveTicketContext(ticket), [ticket]);
  const instancePresentation = useInstancePresentation(ticketContext.instance);
  const contextItems = useMemo(() => {
    const { instance, campaignId, campaignName, productType, strategy } = ticketContext;
    const instanceLabel = instance ? toSentenceCase(instancePresentation.known ? instancePresentation.label : instance) : null;
    return [
      { id: 'instance', label: 'Número', value: instanceLabel },
      { id: 'campaign', label: 'Regra de roteamento', value: campaignName ?? campaignId },
      { id: 'product', label: 'Produto', value: productType },
      { id: 'strategy', label: 'Estratégia', value: strategy },
    ].filter(({ value }) => value);
  }, [instancePresentation.known, instancePresentation.label, ticketContext]);

  return (
    <div className="flex w-full flex-col gap-4">
      <section className="flex w-full flex-col gap-3">
        <h3 className="sr-only">Dados do contato</h3>
        <InlineField
          label="Nome"
          value={displayName}
          placeholder="Nome completo"
          onSave={onContactFieldSave ? (value) => onContactFieldSave('name', value) : undefined}
        />
        <div className="grid gap-3">
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
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="xs" onClick={onCall}>
                <PhoneIcon aria-hidden />
                Ligar
              </Button>
              <Button type="button" variant="outline" size="xs" onClick={onSendSms}>
                Enviar SMS
              </Button>
              {contactId ? (
                <>
                  <Button asChild variant="outline" size="xs">
                    <a href={`/contacts/${encodeURIComponent(contactId)}`}>Abrir contato</a>
                  </Button>
                  <Button asChild variant="outline" size="xs">
                    <a href={`/crm/opportunities?contactId=${encodeURIComponent(contactId)}`}>Ver oportunidades</a>
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <LeadStageSection stage={stage} onStageChange={onStageChange} pendingStage={pendingStage} />
      <ContactSummary ticket={ticket} />
      <NextStepEditor ref={nextStepEditorRef} value={nextStepValue} onSave={onNextStepSave} />

      <div
        ref={contextSectionRef}
        tabIndex={-1}
        className="flex w-full flex-col gap-3 border-t border-border pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-labelledby={contextSectionTitleId}
      >
        <h3 id={contextSectionTitleId} className="text-sm font-semibold text-foreground">
          Origem
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {contextItems.length === 0 && <p className="text-sm text-muted-foreground">Sem dados vinculados.</p>}
          {contextItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              <span className="text-sm text-foreground" title={item.value}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <section className="w-full border-t border-border pt-4 text-xs text-muted-foreground">
        <h3 className="text-sm font-semibold text-foreground">Anexos recentes</h3>
        {attachments.length ? (
          <ul className="mt-2 space-y-2">
            {attachments.slice(0, 5).map((item, index) => {
              const key = item?.id ?? item?.name ?? item?.fileName ?? item?.url ?? index;
              const label = item?.name ?? item?.fileName ?? item?.filename ?? item?.originalName ?? 'Anexo';
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <span className="min-w-0 flex-1 truncate [overflow-wrap:anywhere]">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item?.size ? `${Math.round(item.size / 1024)} KB` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 text-sm">Nenhum anexo nesta conversa.</p>
        )}
      </section>
    </div>
  );
};

export default ContactDetailsPanel;

