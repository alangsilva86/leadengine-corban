import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { MessageCircle, MessageSquareText, Phone, StickyNote } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/utils.js';
import TemplatePicker from './TemplatePicker.jsx';
import emitInboxTelemetry from '../../utils/telemetry.js';

const normalizePhones = (ticket) => {
  const phones = new Set();
  const contactPhones = Array.isArray(ticket?.contact?.phones) ? ticket.contact.phones : [];
  for (const entry of contactPhones) {
    if (entry) phones.add(String(entry));
  }
  if (ticket?.contact?.phone) {
    phones.add(String(ticket.contact.phone));
  }
  if (ticket?.metadata?.contactPhone) {
    phones.add(String(ticket.metadata.contactPhone));
  }
  return Array.from(phones);
};

const resolveSmsUrl = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits ? `sms:${digits}` : null;
};

const resolveTelUrl = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits ? `tel:${digits}` : null;
};

const trackPrimaryAction = (trackerRef, startedAtRef, action, extra = {}) => {
  const ticketId = extra.ticketId ?? null;
  if (!trackerRef.current && startedAtRef.current) {
    const elapsed = performance.now() - startedAtRef.current;
    emitInboxTelemetry('chat.quick_action.time_to_primary', {
      action,
      elapsedMs: Math.round(elapsed),
      ticketId,
    });
    trackerRef.current = true;
  }
  emitInboxTelemetry('chat.quick_action.triggered', {
    action,
    ticketId,
  });
};

export const QuickComposer = ({
  ticket,
  onSendTemplate,
  onCreateNextStep,
  onRegisterCallResult,
}) => {
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [callOutcome, setCallOutcome] = useState('connected');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');

  const phones = useMemo(() => normalizePhones(ticket), [ticket]);
  const [selectedPhone, setSelectedPhone] = useState(() => phones[0] ?? '');

  const startedAtRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const primaryTrackedRef = useRef(false);

  const ticketId = ticket?.id ?? null;

  const handleSelectPhone = useCallback((value) => {
    setSelectedPhone(value);
  }, []);

  const ensurePhone = useCallback(() => {
    const phone = selectedPhone || phones[0];
    if (phone) {
      return phone;
    }
    toast.info('Nenhum telefone disponível para o contato.');
    return null;
  }, [phones, selectedPhone]);

  const handleOpenTemplate = useCallback(() => {
    if (!ensurePhone()) {
      return;
    }
    setTemplatePickerOpen(true);
    trackPrimaryAction(primaryTrackedRef, startedAtRef, 'whatsapp_template', { ticketId });
  }, [ensurePhone, primaryTrackedRef, startedAtRef, ticketId]);

  const handleTemplateSelected = useCallback(
    (template) => {
      if (template) {
        onSendTemplate?.({ ...template, phone: ensurePhone() });
        emitInboxTelemetry('chat.quick_action.template_sent', {
          ticketId,
          templateId: template.id ?? template.name ?? 'template',
        });
      }
      setTemplatePickerOpen(false);
    },
    [ensurePhone, onSendTemplate, ticketId]
  );

  const handleSms = useCallback(() => {
    const phone = ensurePhone();
    if (!phone) return;
    const url = resolveSmsUrl(phone);
    if (url) {
      window.open(url, '_self');
      trackPrimaryAction(primaryTrackedRef, startedAtRef, 'sms', { ticketId });
    } else {
      toast.info('Não foi possível abrir o SMS para este número.');
    }
  }, [ensurePhone, primaryTrackedRef, startedAtRef, ticketId]);

  const handleCall = useCallback(() => {
    const phone = ensurePhone();
    if (!phone) return;
    const url = resolveTelUrl(phone);
    if (url) {
      window.open(url, '_self');
    }
    setCallDialogOpen(true);
    trackPrimaryAction(primaryTrackedRef, startedAtRef, 'call', { ticketId });
  }, [ensurePhone, primaryTrackedRef, startedAtRef, ticketId]);

  const handleTaskSubmit = useCallback(async () => {
    const description = taskDescription.trim();
    if (!description) {
      toast.info('Descreva o próximo passo antes de salvar.');
      return;
    }
    try {
      await onCreateNextStep?.({ description, dueAt: taskDueAt });
      setTaskDescription('');
      setTaskDueAt('');
      trackPrimaryAction(primaryTrackedRef, startedAtRef, 'next_step', { ticketId });
    } catch (error) {
      const message = error?.message ?? 'Falha desconhecida ao salvar o próximo passo.';
      emitInboxTelemetry('chat.quick_action.next_step_error', {
        ticketId,
        message,
      });
      console.error('Falha ao salvar próximo passo no QuickComposer', error);
      toast.error('Não foi possível salvar o próximo passo.', {
        description: message,
      });
    }
  }, [onCreateNextStep, primaryTrackedRef, startedAtRef, taskDescription, taskDueAt, ticketId]);

  const handleCallResultSubmit = useCallback(() => {
    onRegisterCallResult?.({ outcome: callOutcome, notes: callNotes });
    setCallNotes('');
    setCallOutcome('connected');
    setCallDialogOpen(false);
  }, [callNotes, callOutcome, onRegisterCallResult]);

  const renderPhoneSelector = () => {
    if (phones.length <= 1) {
      return null;
    }
    return (
      <Select value={selectedPhone} onValueChange={handleSelectPhone}>
        <SelectTrigger className="h-9 w-full rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet text-left text-xs text-foreground">
          <SelectValue placeholder="Selecione o número" />
        </SelectTrigger>
        <SelectContent>
          {phones.map((phone) => (
            <SelectItem key={phone} value={phone} className="text-sm">
              {formatPhoneNumber(phone)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const formattedPhone = selectedPhone ? formatPhoneNumber(selectedPhone) : phones[0] ? formatPhoneNumber(phones[0]) : 'Sem telefone';

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/80 p-4 shadow-[0_14px_38px_-24px_rgba(15,23,42,0.85)] backdrop-blur">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Quick Composer</h3>
        <p className="text-xs text-foreground-muted">Dispare templates homologados, SMS ou ligações sem sair da conversa.</p>
        <div className="text-xs text-foreground-muted">Telefone selecionado: <span className="font-medium text-foreground">{formattedPhone}</span></div>
        {renderPhoneSelector()}
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            onClick={handleOpenTemplate}
            className="flex flex-col items-center gap-1 rounded-xl bg-emerald-500/90 py-3 text-xs font-semibold text-white shadow-[0_18px_32px_-24px_rgba(16,185,129,0.8)] hover:bg-emerald-500"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSms}
            className="flex flex-col items-center gap-1 rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet py-3 text-xs font-semibold text-foreground"
          >
            <MessageSquareText className="h-4 w-4" />
            SMS
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCall}
            className="flex flex-col items-center gap-1 rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet py-3 text-xs font-semibold text-foreground"
          >
            <Phone className="h-4 w-4" />
            Chamada
          </Button>
        </div>
      </div>

      <Separator className="bg-surface-overlay-glass-border" />

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <StickyNote className="h-4 w-4 text-accent" />
          Próximos passos
        </div>
        <Textarea
          value={taskDescription}
          onChange={(event) => setTaskDescription(event.target.value)}
          placeholder="Descreva a tarefa ou follow-up"
          className="min-h-[90px] rounded-2xl border-none bg-surface-overlay-quiet text-sm text-foreground placeholder:text-foreground-muted ring-1 ring-surface-overlay-glass-border"
        />
        <Input
          type="datetime-local"
          value={taskDueAt}
          onChange={(event) => setTaskDueAt(event.target.value)}
          className="h-10 rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet text-sm"
        />
        <Button
          type="button"
          onClick={handleTaskSubmit}
          className="w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-[0_18px_36px_-24px_rgba(59,130,246,0.8)] hover:bg-primary/90"
        >
          Registrar próximo passo
        </Button>
      </div>

      <TemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={handleTemplateSelected}
      />

      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar resultado da chamada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="call-outcome" className="text-sm font-medium text-foreground">
              Resultado
            </Label>
            <Select value={callOutcome} onValueChange={setCallOutcome}>
              <SelectTrigger id="call-outcome" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="connected">Conectou</SelectItem>
                <SelectItem value="no_answer">Sem resposta</SelectItem>
                <SelectItem value="voicemail">Caixa postal</SelectItem>
              </SelectContent>
            </Select>
            <Label htmlFor="call-notes" className="text-sm font-medium text-foreground">
              Observações
            </Label>
            <Textarea
              id="call-notes"
              value={callNotes}
              onChange={(event) => setCallNotes(event.target.value)}
              placeholder="Resumo do contato"
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCallDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCallResultSubmit}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickComposer;
