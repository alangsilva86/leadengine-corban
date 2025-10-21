import { useMemo, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import LeadSummaryCard from './LeadSummaryCard.jsx';
import LeadDetailsTabs from './LeadDetailsTabs.jsx';
import ConsentInfo from './ConsentInfo.jsx';
import ProposalMiniSim from './ProposalMiniSim.jsx';
import NotesSection from './NotesSection.jsx';
import TasksSection from './TasksSection.jsx';
import AuditTrailLink from './AuditTrailLink.jsx';
import QuickComposer from '../ConversationArea/QuickComposer.jsx';
import { CardBody, GENERATE_PROPOSAL_ANCHOR_ID } from '../ConversationArea/ConversationHeader.jsx';
import AttachmentPreview from '../Shared/AttachmentPreview.jsx';
import ContactSummary from '@/features/contacts/components/ContactSummary.jsx';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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

export const DetailsPanel = ({
  ticket,
  onCreateNote,
  notesLoading,
  onSendTemplate,
  onCreateNextStep,
  onRegisterCallResult,
  onReopenWindow,
  onOpenAudit,
}) => {
  const notesSectionRef = useRef(null);

  const attachments = useMemo(() => {
    const list = ticket?.metadata?.attachments;
    if (Array.isArray(list)) {
      return list;
    }
    return [];
  }, [ticket?.metadata?.attachments]);

  return (
    <CardBody className="mt-0 border-t-0 pt-0">
      <CardBody.Left>
        <QuickComposer
          ticket={ticket}
          onSendTemplate={onSendTemplate}
          onCreateNextStep={onCreateNextStep}
          onRegisterCallResult={onRegisterCallResult}
        />
      </CardBody.Left>
      <CardBody.Right>
        <Tabs defaultValue="contact" className="flex flex-1 flex-col gap-3">
          <TabsList className="w-full justify-start bg-surface-overlay-quiet p-1">
            <TabsTrigger value="contact">Contato</TabsTrigger>
            <TabsTrigger value="opportunity">Oportunidade</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="attachments">Anexos & Notas</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-3">
            <ContactSummary contact={ticket?.contact} />
            <LeadDetailsTabs ticket={ticket} />
            <ConsentInfo consent={ticket?.contact?.consent} />
          </TabsContent>

          <TabsContent value="opportunity" className="space-y-3">
            <LeadSummaryCard lead={ticket?.lead} />
            <ProposalMiniSim
              lead={ticket?.lead}
              primaryCtaHref={`#${GENERATE_PROPOSAL_ANCHOR_ID}`}
            />
            <TasksSection ticket={ticket} onReopenWindow={onReopenWindow} />
            <AuditTrailLink onOpenAudit={onOpenAudit} />
          </TabsContent>

          <TabsContent value="timeline" className="space-y-3">
            <TimelineSummary ticket={ticket} />
          </TabsContent>

          <TabsContent value="attachments" className="space-y-4">
            <AttachmentsPanel attachments={attachments} />
            <NotesSection
              ref={notesSectionRef}
              notes={ticket?.notes ?? []}
              onCreate={onCreateNote}
              loading={notesLoading}
            />
          </TabsContent>
        </Tabs>
      </CardBody.Right>
    </CardBody>
  );
};

export default DetailsPanel;
