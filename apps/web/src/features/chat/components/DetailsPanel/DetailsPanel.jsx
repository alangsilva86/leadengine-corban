import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import LeadSummaryCard from './LeadSummaryCard.jsx';
import LeadDetailsTabs from './LeadDetailsTabs.jsx';
import ConsentInfo from './ConsentInfo.jsx';
import ProposalMiniSim from './ProposalMiniSim.jsx';
import NotesSection from './NotesSection.jsx';
import TasksSection from './TasksSection.jsx';
import AuditTrailLink from './AuditTrailLink.jsx';
import { GENERATE_PROPOSAL_ANCHOR_ID } from '../ConversationArea/ConversationHeader.jsx';
import AttachmentPreview from '../Shared/AttachmentPreview.jsx';
import StatusBadge from '../Shared/StatusBadge.jsx';
import { buildQuickActionLinks } from '../Shared/ConversationActions.jsx';
import ContactSummary from '@/features/contacts/components/ContactSummary.jsx';
import { formatDateTime } from '../../utils/datetime.js';
import {
  Briefcase,
  Check,
  Clock3,
  Copy,
  FileText,
  Info,
  Mail,
  NotebookPen,
  Paperclip,
  Phone,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react';
import { useClipboard } from '@/hooks/use-clipboard.js';
import {
  detailsPanelContainer,
  panelHeaderLayout,
  panelHeaderSection,
  sectionContent,
  sectionContentInner,
  sectionGroup,
  sectionItem,
  sectionTrigger,
  tabsContent,
  tabsList,
} from './detailsPanelStyles.ts';

/**
 * @typedef {Object} DetailsPanelContext
 * @property {import('react').MutableRefObject<unknown>} notesSectionRef
 * @property {Object|null} ticket
 * @property {Array} attachments
 * @property {number} attachmentsCount
 * @property {number} notesCount
 * @property {number} timelineCount
 * @property {(...args: any[]) => void} [onCreateNote]
 * @property {boolean} [notesLoading]
 * @property {(windowId: string) => void} [onReopenWindow]
 * @property {() => void} [onOpenAudit]
 * @property {() => void} [onNotesSectionOpen]
 */

/**
 * @typedef {Object} PanelSectionDefinition
 * @property {string} value
 * @property {import('lucide-react').LucideIcon} [icon]
 * @property {string} title
 * @property {string} [description]
 * @property {import('react').ReactNode} [children]
 * @property {(context: DetailsPanelContext) => import('react').ReactNode} [render]
 * @property {(context: DetailsPanelContext) => number} [getCount]
 * @property {number} [count]
 * @property {(context: DetailsPanelContext) => import('react').ReactNode} [renderAction]
 * @property {import('react').ReactNode} [action]
 * @property {boolean} [defaultOpen]
 * @property {(context: DetailsPanelContext) => () => void} [getOnOpen]
 */

/**
 * @typedef {Object} TabDefinition
 * @property {string} value
 * @property {string} label
 * @property {PanelSectionDefinition[]} sections
 */

/**
 * @type {TabDefinition[]}
 */
const DETAILS_PANEL_TABS = [
  {
    value: 'contact',
    label: 'Contato',
    sections: [
      {
        value: 'summary',
        icon: UserCircle2,
        title: 'Ficha do contato',
        description: 'Informações cadastrais e campos personalizados organizadas por categoria.',
        render: ({ ticket }) => <ContactSummary contact={ticket?.contact} />,
      },
      {
        value: 'details',
        icon: Info,
        title: 'Campos do atendimento',
        description: 'Campos personalizados e dados operacionais do ticket.',
        render: ({ ticket }) => <LeadDetailsTabs ticket={ticket} />,
      },
      {
        value: 'consent',
        icon: ShieldCheck,
        title: 'Consentimento',
        description: 'Preferências de comunicação registradas para o contato.',
        render: ({ ticket }) => <ConsentInfo consent={ticket?.contact?.consent} />,
      },
    ],
  },
  {
    value: 'opportunity',
    label: 'Oportunidade',
    sections: [
      {
        value: 'lead-summary',
        icon: Briefcase,
        title: 'Resumo da oportunidade',
        description: 'Status, valor estimado e principais indicadores do lead.',
        render: ({ ticket }) => <LeadSummaryCard lead={ticket?.lead} />,
      },
      {
        value: 'proposal',
        icon: FileText,
        title: 'Simulação & propostas',
        description: 'Acesse rapidamente a mini simulação e gere uma proposta atualizada.',
        render: ({ ticket }) => (
          <ProposalMiniSim
            lead={ticket?.lead}
            primaryCtaHref={`#${GENERATE_PROPOSAL_ANCHOR_ID}`}
          />
        ),
      },
      {
        value: 'tasks',
        icon: NotebookPen,
        title: 'Tarefas e follow-ups',
        description: 'Gerencie janelas de reabertura e ações pendentes para este ticket.',
        render: ({ ticket, onReopenWindow }) => (
          <TasksSection ticket={ticket} onReopenWindow={onReopenWindow} />
        ),
      },
      {
        value: 'audit',
        icon: Info,
        title: 'Auditoria',
        description: 'Histórico completo de alterações relacionadas ao atendimento.',
        render: ({ onOpenAudit }) => <AuditTrailLink onOpenAudit={onOpenAudit} />,
      },
    ],
  },
  {
    value: 'timeline',
    label: 'Timeline',
    sections: [
      {
        value: 'activity',
        icon: Clock3,
        title: 'Registro de interações',
        description: 'Resumo cronológico das mensagens e ações trocadas com o cliente.',
        getCount: ({ timelineCount }) => timelineCount,
        render: ({ ticket }) => <TimelineSummary ticket={ticket} />,
      },
    ],
  },
  {
    value: 'attachments',
    label: 'Anexos & Notas',
    sections: [
      {
        value: 'files',
        icon: Paperclip,
        title: 'Anexos compartilhados',
        description: 'Arquivos e mídias enviados durante a conversa.',
        getCount: ({ attachmentsCount }) => attachmentsCount,
        render: ({ attachments }) => <AttachmentsPanel attachments={attachments} />,
      },
      {
        value: 'notes',
        icon: NotebookPen,
        title: 'Notas internas',
        description: 'Comentários privados para alinhamento entre a equipe.',
        getCount: ({ notesCount }) => notesCount,
        getOnOpen: ({ onNotesSectionOpen }) => onNotesSectionOpen,
        render: ({ ticket, onCreateNote, notesLoading, notesSectionRef }) => (
          <NotesSection
            ref={notesSectionRef}
            notes={ticket?.notes ?? []}
            onCreate={onCreateNote}
            loading={notesLoading}
          />
        ),
      },
    ],
  },
];

const TimelineSummary = ({ ticket }) => {
  const entries = useMemo(() => {
    if (!ticket?.timeline) return [];
    const timeline = ticket.timeline;
    const items = [];
    if (timeline.firstInboundAt) {
      items.push({ label: 'Primeiro inbound', value: formatDateTime(timeline.firstInboundAt) });
    }
    if (timeline.firstOutboundAt) {
      items.push({ label: 'Primeira resposta', value: formatDateTime(timeline.firstOutboundAt) });
    }
    if (timeline.lastInboundAt) {
      items.push({ label: 'Último cliente', value: formatDateTime(timeline.lastInboundAt) });
    }
    if (timeline.lastOutboundAt) {
      items.push({ label: 'Último agente', value: formatDateTime(timeline.lastOutboundAt) });
    }
    if (timeline.unreadInboundCount !== undefined) {
      items.push({ label: 'Pendências do cliente', value: `${timeline.unreadInboundCount} mensagens` });
    }
    return items;
  }, [ticket?.timeline]);

  if (entries.length === 0) {
    return <p className="text-xs text-foreground-muted">Sem eventos registrados para este ticket.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <div
          key={entry.label}
          className="flex items-center justify-between rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 py-2 text-xs"
        >
          <span className="font-medium text-foreground">{entry.label}</span>
          <span className="text-foreground-muted">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const AttachmentsPanel = ({ attachments }) => {
  if (!attachments?.length) {
    return <p className="text-xs text-foreground-muted">Nenhum anexo compartilhado neste ticket até o momento.</p>;
  }
  return <AttachmentPreview attachments={attachments} />;
};

const scheduleNextFrame = (callback) => {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(callback, 0);
};

const SectionGroup = ({ baseId, sections }) => {
  const defaultValues = useMemo(() => {
    return sections.reduce((values, section, index) => {
      if (section.defaultOpen === true) {
        values.push(`${baseId}-${section.value}`);
        return values;
      }
      if (section.defaultOpen === undefined && index === 0) {
        values.push(`${baseId}-${section.value}`);
      }
      return values;
    }, []);
  }, [baseId, sections]);

  return (
    <Accordion type="multiple" defaultValue={defaultValues} className={sectionGroup()}>
      {sections.map((section) => (
        <PanelSection key={section.value} {...section} sectionId={`${baseId}-${section.value}`} />
      ))}
    </Accordion>
  );
};

const PanelSection = ({
  sectionId,
  icon: Icon,
  title,
  description,
  count,
  action,
  children,
  onOpen,
}) => (
  <AccordionItem value={sectionId} className={sectionItem()}>
    <AccordionTrigger
      className={sectionTrigger()}
      onClick={(event) => {
        if (!onOpen) return;
        const target = event.currentTarget;
        scheduleNextFrame(() => {
          if (target?.getAttribute('aria-expanded') === 'true') {
            onOpen();
          }
        });
      }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {Icon ? (
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{title}</span>
            {typeof count === 'number' ? (
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[11px] font-medium">
                {count}
              </Badge>
            ) : null}
          </div>
          {description ? <p className="text-xs font-normal text-foreground-muted break-words">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="pl-2 shrink-0">{action}</div> : null}
    </AccordionTrigger>
    <AccordionContent className={sectionContent()}>
      <div className={sectionContentInner()}>
        {children}
      </div>
    </AccordionContent>
  </AccordionItem>
);

const CopyButton = ({ value, label }) => {
  const { copy } = useClipboard();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  const handleCopy = useCallback(async () => {
    const success = await copy(value, {
      emptyMessage: null,
      successMessage: null,
      errorMessage: null,
      fallbackMessage: null,
    });
    if (success) {
      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } else {
      setCopied(false);
    }
  }, [copy, value]);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  if (
    !value ||
    (typeof value === 'string' && (value.trim().length === 0 || value.trim() === '—'))
  ) {
    return null;
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="shrink-0 text-foreground-muted hover:text-foreground"
      onClick={handleCopy}
      aria-label={label}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
    </Button>
  );
};

const QuickActionsBar = ({ actions }) => {
  if (!actions?.length) {
    return null;
  }

  return (
    <nav
      aria-label="Ações rápidas do atendimento"
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-surface-overlay-glass-border bg-surface-overlay-quiet/30 p-3"
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            variant="ghost"
            size="sm"
            asChild
            className="h-auto rounded-lg border border-transparent px-2 py-1 text-xs font-medium text-foreground-muted hover:border-surface-overlay-glass-border hover:bg-surface-overlay-quiet"
          >
            <a href={`#${action.id}`} className="inline-flex items-center gap-1">
              {Icon ? <Icon className="size-4" aria-hidden /> : null}
              <span>{action.label}</span>
            </a>
          </Button>
        );
      })}
    </nav>
  );
};

const HeaderItem = ({ label, value, icon: Icon, copyValue }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{label}</span>
    <div className="text-sm text-foreground flex flex-wrap items-center gap-2 min-w-0">
      <div className="flex min-w-0 items-center gap-2 break-words">
        {Icon ? <Icon className="text-foreground-muted size-4 shrink-0" aria-hidden /> : null}
        <span className="font-medium break-words break-all max-w-full">{value ?? '—'}</span>
      </div>
      <CopyButton value={copyValue ?? value} label={`Copiar ${label.toLowerCase()}`} />
    </div>
  </div>
);

const PanelHeader = ({ contact, lead }) => {
  const name = contact?.name ?? 'Contato sem nome';
  const organization = contact?.company ?? contact?.organization ?? null;
  const phone = contact?.phone ?? contact?.primaryPhone ?? contact?.phoneDetails?.[0]?.phoneNumber;
  const email = contact?.email ?? contact?.primaryEmail ?? contact?.emailDetails?.[0]?.email;
  const document = contact?.document ?? null;
  const status = lead?.status ?? contact?.status ?? null;

  return (
    <section className={panelHeaderSection()}>
      <div className={panelHeaderLayout()}>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Contato principal</span>
          <h2 className="text-xl font-semibold leading-tight text-foreground">{name}</h2>
          {organization ? <p className="text-sm text-foreground-muted">{organization}</p> : null}
        </div>
        {status ? <StatusBadge status={status} className="shrink-0" /> : null}
      </div>
      <dl className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
        <HeaderItem label="Telefone" value={phone ?? '—'} icon={Phone} copyValue={phone} />
        <HeaderItem label="E-mail" value={email ?? '—'} icon={Mail} copyValue={email} />
        <HeaderItem label="Documento" value={document ?? '—'} icon={FileText} />
        <HeaderItem label="ID do contato" value={contact?.id ?? '—'} icon={Info} copyValue={contact?.id} />
      </dl>
    </section>
  );
};

export const countVisibleTimelineEntries = (items) => {
  if (!Array.isArray(items)) {
    return 0;
  }

  return items.reduce((total, entry) => {
    if (!entry || entry.hidden) {
      return total;
    }

    const type = typeof entry.type === 'string' ? entry.type.toLowerCase() : '';

    if (!type || type === 'divider') {
      return total;
    }

    return total + 1;
  }, 0);
};

export const DetailsPanel = ({
  ticket,
  onCreateNote,
  notesLoading,
  onReopenWindow,
  onOpenAudit,
  timelineItems = [],
}) => {
  const notesSectionRef = useRef(null);
  const handleNotesSectionOpen = useCallback(() => {
    const target = notesSectionRef.current;
    target?.focusComposer?.();
  }, []);

  const attachments = useMemo(() => {
    const list = ticket?.metadata?.attachments;
    if (Array.isArray(list)) {
      return list;
    }
    return [];
  }, [ticket?.metadata?.attachments]);

  const quickActionLinks = useMemo(
    () =>
      buildQuickActionLinks({
        canAssign: true,
        canScheduleFollowUp: true,
        canRegisterResult: true,
        hasPhone: Boolean(ticket?.contact?.phone ?? ticket?.metadata?.contactPhone),
      }),
    [ticket?.contact?.phone, ticket?.metadata?.contactPhone],
  );

  const notesCount = ticket?.notes?.length ?? 0;
  const attachmentsCount = attachments.length;
  const timelineCount = useMemo(() => countVisibleTimelineEntries(timelineItems), [timelineItems]);

  const tabs = useMemo(() => {
    const context = {
      ticket,
      attachments,
      attachmentsCount,
      notesCount,
      timelineCount,
      notesSectionRef,
      onCreateNote,
      notesLoading,
      onReopenWindow,
      onOpenAudit,
      onNotesSectionOpen: handleNotesSectionOpen,
    };

    return DETAILS_PANEL_TABS.map((tab) => ({
      ...tab,
      sections: tab.sections.map((section) => {
        const { render, getCount, renderAction, getOnOpen, ...rest } = section;
        return {
          ...rest,
          count: typeof getCount === 'function' ? getCount(context) : section.count,
          action: typeof renderAction === 'function' ? renderAction(context) : section.action,
          children: typeof render === 'function' ? render(context) : section.children,
          onOpen: typeof getOnOpen === 'function' ? getOnOpen(context) : section.onOpen,
        };
      }),
    }));
  }, [
    ticket,
    attachments,
    attachmentsCount,
    notesCount,
    timelineCount,
    onCreateNote,
    notesLoading,
    onReopenWindow,
    onOpenAudit,
    handleNotesSectionOpen,
  ]);

  return (
    <div className={detailsPanelContainer()}>
      <PanelHeader contact={ticket?.contact ?? null} lead={ticket?.lead ?? null} />

      <QuickActionsBar actions={quickActionLinks} />

      <Tabs defaultValue="contact" className="flex flex-1 min-w-0 flex-col gap-5">
        <TabsList className={tabsList()}>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className={tabsContent()}>
            <SectionGroup baseId={tab.value} sections={tab.sections} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default DetailsPanel;
