import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { cn, formatPhoneNumber, buildInitials } from '@/lib/utils.js';
import { toast } from 'sonner';
import {
  CalendarClock,
  ChevronDown,
  ClipboardList,
  FileText,
  IdCard,
  Phone,
  UserPlus,
} from 'lucide-react';
import QuickComposer from './QuickComposer.jsx';
import emitInboxTelemetry from '../../utils/telemetry.js';

const LOSS_REASONS = [
  { value: 'sem_interesse', label: 'Sem interesse' },
  { value: 'orcamento', label: 'Sem orçamento disponível' },
  { value: 'concorrencia', label: 'Fechou com a concorrência' },
  { value: 'documentacao', label: 'Documentação incompleta' },
  { value: 'outro', label: 'Outro' },
];

const RESULT_ITEMS = [
  { value: 'won', label: 'Ganho' },
  { value: 'lost', label: 'Perda' },
  { value: 'no_contact', label: 'Sem contato' },
  { value: 'disqualified', label: 'Desqualificado' },
];

const STATUS_LABELS = {
  OPEN: 'Aberto',
  PENDING: 'Pendente',
  ASSIGNED: 'Em atendimento',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
};

const STATUS_TONE = {
  OPEN: 'info',
  PENDING: 'info',
  ASSIGNED: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const CHIP_STYLES = {
  info: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
  warning: 'border-warning-soft-border bg-warning-soft text-warning-strong',
  danger: 'border-status-error-border bg-status-error-surface text-status-error-foreground',
  neutral: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
  success: 'border-success-soft-border bg-success-soft text-success-strong',
};

const LOSS_REASON_HELPERS = LOSS_REASONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const formatPotential = (value) => {
  if (value === null || value === undefined) return 'R$ —';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return `R$ ${value}`;
  }
  return `R$ ${numeric.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
};

const formatProbability = (value) => {
  if (value === null || value === undefined) return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return `${Math.round(numeric)}%`;
};

const getStatusInfo = (status) => {
  const normalized = status ? String(status).toUpperCase() : 'OPEN';
  return {
    label: STATUS_LABELS[normalized] ?? normalized,
    tone: STATUS_TONE[normalized] ?? 'neutral',
  };
};

const minutesToHoursLabel = (minutes) => {
  if (minutes === undefined || minutes === null) return null;
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours} h`;
};

const getExpirationInfo = (windowInfo = {}) => {
  const { remainingMinutes, isOpen } = windowInfo;

  if (isOpen === false) {
    return { label: 'Janela expirada', tone: 'danger' };
  }

  if (remainingMinutes === undefined || remainingMinutes === null) {
    return { label: 'Expira em breve', tone: 'warning' };
  }

  if (remainingMinutes <= 120) {
    const label = remainingMinutes <= 60
      ? `Expira em ${remainingMinutes} min`
      : `Expira em ${Math.round(remainingMinutes / 60)} h`;
    return { label, tone: 'danger' };
  }

  if (remainingMinutes < 1440) {
    const label = remainingMinutes <= 180
      ? `Expira em ${Math.round(remainingMinutes / 60)} h`
      : 'Expira em 24h';
    return { label, tone: 'warning' };
  }

  const days = Math.floor(remainingMinutes / 1440);
  return { label: `Expira em ${days}d`, tone: 'warning' };
};

const buildSlaTooltip = (windowInfo = {}) => {
  const lastInteraction = minutesToHoursLabel(windowInfo.lastInteractionMinutes);
  if (!lastInteraction) {
    return 'Prazo para primeira resposta.';
  }
  return `Prazo para primeira resposta. Último contato há ${lastInteraction}.`;
};

const Chip = ({ tone = 'neutral', className, children, ...props }) => (
  <span
    className={cn(
      'inline-flex min-h-[28px] items-center justify-center rounded-full px-3 text-[12px] font-medium leading-none tracking-wide',
      CHIP_STYLES[tone] ?? CHIP_STYLES.neutral,
      className,
    )}
    {...props}>
    {children}
  </span>
);

const TypingIndicator = ({ agents = [] }) => {
  if (!agents.length) return null;
  const label = agents[0]?.userName ?? 'Agente';
  return (
    <div className="inline-flex min-h-[28px] items-center gap-2 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 text-[12px] text-foreground-muted">
      <div className="flex -space-x-2">
        {agents.slice(0, 3).map((agent) => (
          <Avatar key={agent.userId} className="h-6 w-6 border border-surface-overlay-glass-border">
            <AvatarFallback>{buildInitials(agent.userName, 'AG')}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span>{label} digitando…</span>
    </div>
  );
};

const MetadataBadge = ({ icon: Icon, children, className, ...props }) => (
  <button
    type="button"
    className={cn(
      'inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-overlay-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-overlay-glass-border',
      className,
    )}
    {...props}>
    {Icon ? <Icon className="size-4" aria-hidden /> : null}
    <span className="truncate text-left">{children}</span>
  </button>
);

export const CardBody = ({ children, className }) => (
  <div
    className={cn(
      'mt-3 grid gap-4 border-t border-surface-overlay-glass-border pt-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]',
      className,
    )}
  >
    {children}
  </div>
);

CardBody.Left = function CardBodyLeft({ children, className }) {
  return <div className={cn('flex flex-col gap-4', className)}>{children}</div>;
};

CardBody.Right = function CardBodyRight({ children, className }) {
  return <div className={cn('flex flex-col gap-4', className)}>{children}</div>;
};

export const ConversationHeader = ({
  ticket,
  onRegisterResult,
  onAssign,
  onGenerateProposal,
  onScheduleFollowUp,
  onSendTemplate,
  onCreateNextStep,
  onRegisterCallResult,
  typingAgents = [],
  isRegisteringResult = false,
}) => {
  const [isFadeIn, setIsFadeIn] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [resultSelection, setResultSelection] = useState('');
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [lossNotes, setLossNotes] = useState('');
  const [lossSubmitted, setLossSubmitted] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setIsFadeIn(false);
    setIsExpanded(false);
    const frame = requestAnimationFrame(() => setIsFadeIn(true));
    return () => cancelAnimationFrame(frame);
  }, [ticket?.id, ticket]);

  useEffect(() => {
    emitInboxTelemetry('chat.header.toggle', {
      ticketId: ticket?.id ?? null,
      open: isExpanded,
    });
  }, [isExpanded, ticket?.id]);

  const name = ticket?.contact?.name ?? ticket?.subject ?? 'Contato sem nome';
  const company = ticket?.metadata?.company ?? ticket?.contact?.company;
  const title = company ? `${name} | ${company}` : name;
  const phoneDisplay = formatPhoneNumber(ticket?.contact?.phone || ticket?.metadata?.contactPhone);
  const rawPhone = ticket?.contact?.phone || ticket?.metadata?.contactPhone || null;
  const document = ticket?.contact?.document ?? '—';

  const statusInfo = useMemo(() => getStatusInfo(ticket?.status), [ticket?.status]);
  const expirationInfo = useMemo(() => getExpirationInfo(ticket?.window), [ticket?.window]);
  const slaTooltip = useMemo(() => buildSlaTooltip(ticket?.window), [ticket?.window]);

  const subtitle = useMemo(() => {
    const id = ticket?.lead?.id ?? ticket?.id ?? '—';
    const potential = formatPotential(ticket?.lead?.value);
    const probability = formatProbability(ticket?.lead?.probability);
    const stage = ticket?.pipelineStep ?? ticket?.metadata?.pipelineStep ?? '—';
    return `ID #${id} • Potencial ${potential} • Prob. ${probability} • Etapa: ${stage}`;
  }, [ticket?.lead?.id, ticket?.lead?.value, ticket?.lead?.probability, ticket?.pipelineStep, ticket?.metadata?.pipelineStep, ticket?.id]);

  const resetLossState = useCallback(() => {
    setLossReason('');
    setLossNotes('');
    setLossSubmitted(false);
  }, []);

  const handleResult = useCallback(async (value, reason) => {
    if (!onRegisterResult) {
      toast.error('Não foi possível concluir. Tente novamente.');
      return;
    }

    setResultSelection(value);
    try {
      await onRegisterResult({ outcome: value === 'won' ? 'won' : 'lost', reason });
    } finally {
      setResultSelection('');
    }
  }, [onRegisterResult]);

  const handleResultChange = useCallback(async (value) => {
    if (!value) return;
    if (value === 'lost') {
      setLossDialogOpen(true);
      return;
    }

    const reasonMap = {
      won: 'Negócio ganho',
      no_contact: 'Sem contato',
      disqualified: 'Lead desqualificado',
    };
    const reason = reasonMap[value];
    await handleResult(value, reason);
  }, [handleResult]);

  const handleConfirmLoss = useCallback(async () => {
    setLossSubmitted(true);
    if (!lossReason) {
      return;
    }
    const reasonLabel = LOSS_REASON_HELPERS[lossReason] ?? lossReason;
    const finalReason = lossNotes ? `${reasonLabel} — ${lossNotes}` : reasonLabel;
    try {
      await handleResult('lost', finalReason);
      setLossDialogOpen(false);
      resetLossState();
    } catch {
      // feedback handled upstream
    }
  }, [handleResult, lossReason, lossNotes, resetLossState]);

  const handleCloseLossDialog = useCallback((nextOpen) => {
    setLossDialogOpen(nextOpen);
    if (!nextOpen) {
      resetLossState();
    }
  }, [resetLossState]);

  const handlePhoneAction = useCallback((action) => {
    if (!rawPhone) {
      toast.info('Nenhum telefone disponível para este lead.');
      return;
    }
    const digits = String(rawPhone).replace(/\D/g, '');
    const hasWindow = typeof window !== 'undefined';
    const hasClipboard = typeof navigator !== 'undefined' && navigator.clipboard;

    switch (action) {
      case 'call':
        if (hasWindow) {
          window.open(`tel:${digits}`, '_self');
        } else {
          toast.info(`Ligue para ${rawPhone}.`);
        }
        break;
      case 'whatsapp':
        if (hasWindow) {
          window.open(`https://wa.me/${digits}`, '_blank', 'noopener');
        } else {
          toast.info(`Abra o WhatsApp e contate ${rawPhone}.`);
        }
        break;
      case 'copy':
        if (hasClipboard) {
          navigator.clipboard
            .writeText(rawPhone)
            .then(() => toast.success('Telefone copiado.'))
            .catch(() => toast.error('Não foi possível concluir. Tente novamente.'));
        } else {
          toast.info(`Copie manualmente: ${rawPhone}`);
        }
        break;
      default:
        break;
    }
  }, [rawPhone]);

  const handleCopyDocument = useCallback(() => {
    if (!document || document === '—') {
      toast.info('Nenhum documento disponível para copiar.');
      return;
    }
    const hasClipboard = typeof navigator !== 'undefined' && navigator.clipboard;
    if (hasClipboard) {
      navigator.clipboard
        .writeText(document)
        .then(() => toast.success('Documento copiado.'))
        .catch(() => toast.error('Não foi possível concluir. Tente novamente.'));
    } else {
      toast.info(`Copie manualmente: ${document}`);
    }
  }, [document]);

  if (!ticket) {
    return (
      <div className="flex h-24 items-center justify-center rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet text-sm text-foreground-muted shadow-inner shadow-slate-950/40 backdrop-blur">
        Selecione um ticket para visualizar a conversa.
      </div>
    );
  }

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn(
        'rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-strong px-4 py-3 shadow-[0_6px_24px_rgba(15,23,42,0.3)] backdrop-blur transition-opacity duration-150',
        isFadeIn ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-base font-semibold leading-tight text-foreground">
              {title}
            </h3>
            <Chip tone={statusInfo.tone} className="px-2.5 py-1 text-[11px]">
              {statusInfo.label}
            </Chip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Chip tone={expirationInfo.tone} className="cursor-default select-none px-2.5 py-1 text-[11px]">
                  {expirationInfo.label}
                </Chip>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                <p className="max-w-[220px] text-xs text-foreground-muted">{slaTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="truncate text-xs text-foreground-muted">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <TypingIndicator agents={typingAgents} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onGenerateProposal?.(ticket)}
                className="size-9 rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted hover:bg-surface-overlay-strong"
                aria-label="Gerar proposta"
              >
                <FileText className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Gerar proposta</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onAssign?.(ticket)}
                className="size-9 rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted hover:bg-surface-overlay-strong"
                aria-label="Atribuir"
              >
                <UserPlus className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Atribuir</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onScheduleFollowUp?.(ticket)}
                className="size-9 rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted hover:bg-surface-overlay-strong"
                aria-label="Agendar follow-up"
              >
                <CalendarClock className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Agendar follow-up</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Registrar resultado"
                    className="size-9 rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted hover:bg-surface-overlay-strong"
                    disabled={isRegisteringResult}
                  >
                    <ClipboardList className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Registrar resultado</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuRadioGroup value={resultSelection || undefined} onValueChange={handleResultChange}>
                {RESULT_ITEMS.map((item) => (
                  <DropdownMenuRadioItem
                    key={item.value}
                    value={item.value}
                    className="min-h-[44px]"
                    disabled={isRegisteringResult}
                  >
                    {item.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Opções de telefone"
                    className="size-9 rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted hover:bg-surface-overlay-strong"
                  >
                    <Phone className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Opções de telefone</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem className="min-h-[44px]" onSelect={() => handlePhoneAction('call')}>
                Ligar
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-[44px]" onSelect={() => handlePhoneAction('whatsapp')}>
                Abrir WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-[44px]" onSelect={() => handlePhoneAction('copy')}>
                Copiar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCopyDocument}
                className="size-9 rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted hover:bg-surface-overlay-strong"
                aria-label="Copiar documento"
              >
                <IdCard className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Copiar documento</TooltipContent>
          </Tooltip>

          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
              className="size-9 rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted hover:bg-surface-overlay-strong"
            >
              <ChevronDown
                className={cn('size-4 transition-transform duration-200', isExpanded ? 'rotate-180' : 'rotate-0')}
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <CardBody>
          <CardBody.Left>
            <QuickComposer
              ticket={ticket}
              onSendTemplate={onSendTemplate}
              onCreateNextStep={onCreateNextStep}
              onRegisterCallResult={onRegisterCallResult}
            />
          </CardBody.Left>
          <CardBody.Right>
            <p className="text-xs text-foreground-muted">{subtitle}</p>

            <section className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => onGenerateProposal?.(ticket)}
                className="rounded-lg bg-sky-500 px-3 text-xs font-semibold text-white hover:bg-sky-400 focus-visible:ring-sky-300 active:bg-sky-600"
              >
                Gerar proposta
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAssign?.(ticket)}
                className="rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-xs font-medium text-foreground-muted hover:bg-surface-overlay-strong"
              >
                Atribuir
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onScheduleFollowUp?.(ticket)}
                className="rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet text-xs font-medium text-foreground-muted hover:bg-surface-overlay-strong"
              >
                Agendar follow-up
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    aria-label="Registrar resultado"
                    className="rounded-lg bg-surface-overlay-quiet px-3 text-xs font-medium text-foreground hover:bg-surface-overlay-strong focus-visible:ring-surface-overlay-glass-border"
                    disabled={isRegisteringResult}
                  >
                    <span className="mr-1">Registrar resultado</span>
                    <ChevronDown className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuRadioGroup value={resultSelection || undefined} onValueChange={handleResultChange}>
                    {RESULT_ITEMS.map((item) => (
                      <DropdownMenuRadioItem
                        key={item.value}
                        value={item.value}
                        className="min-h-[40px]"
                        disabled={isRegisteringResult}
                      >
                        {item.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </section>

            <footer className="flex flex-wrap items-center gap-2 pt-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <MetadataBadge icon={Phone} aria-label="Telefone">
                    {phoneDisplay}
                  </MetadataBadge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuItem className="min-h-[44px]" onSelect={() => handlePhoneAction('call')}>
                    Ligar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="min-h-[44px]" onSelect={() => handlePhoneAction('whatsapp')}>
                    Abrir WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem className="min-h-[44px]" onSelect={() => handlePhoneAction('copy')}>
                    Copiar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <MetadataBadge
                icon={IdCard}
                aria-label="Copiar documento"
                onClick={handleCopyDocument}
              >
                Doc: {document}
              </MetadataBadge>
            </footer>
          </CardBody.Right>
        </CardBody>
      </CollapsibleContent>

      <Dialog open={lossDialogOpen} onOpenChange={handleCloseLossDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar perda</DialogTitle>
            <DialogDescription>
              Informe o motivo da perda para manter o funil atualizado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="loss-reason">Motivo *</Label>
              <Select value={lossReason} onValueChange={(value) => { setLossReason(value); setLossSubmitted(false); }}>
                <SelectTrigger id="loss-reason" className="w-full min-h-[44px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lossSubmitted && !lossReason ? (
                <p className="text-xs text-rose-300">Selecione um motivo para continuar.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="loss-notes">Observações (opcional)</Label>
              <Textarea
                id="loss-notes"
                value={lossNotes}
                onChange={(event) => setLossNotes(event.target.value)}
                placeholder="Detalhe o motivo ou próximos passos."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleCloseLossDialog(false)} className="min-h-[44px]">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmLoss}
              disabled={isRegisteringResult}
              className="min-h-[44px]"
            >
              Registrar perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
};

export default ConversationHeader;
