import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command.jsx';
import { cn, formatPhoneNumber } from '@/lib/utils.js';

import useUpdateContactField from '../../api/useUpdateContactField.js';
import useUpsertContactPhone from '../../api/useUpsertContactPhone.js';
import useDeleteContactPhone from '../../api/useDeleteContactPhone.js';
import useUpsertContactEmail from '../../api/useUpsertContactEmail.js';
import useDeleteContactEmail from '../../api/useDeleteContactEmail.js';
import useListContactTagsQuery from '../../api/useListContactTagsQuery.js';
import useUpsertContactTag from '../../api/useUpsertContactTag.js';
import useDeleteContactTag from '../../api/useDeleteContactTag.js';
import useUpdateLeadField from '../../api/useUpdateLeadField.js';
import useSearchUsersQuery from '../../api/useSearchUsersQuery.js';
import useCampaignsLookupQuery from '../../api/useCampaignsLookupQuery.js';

const PHONE_TYPE_OPTIONS = [
  { value: 'MOBILE', label: 'Celular' },
  { value: 'HOME', label: 'Residencial' },
  { value: 'WORK', label: 'Comercial' },
  { value: 'OTHER', label: 'Outro' },
];

const EMAIL_TYPE_OPTIONS = [
  { value: 'WORK', label: 'Trabalho' },
  { value: 'PERSONAL', label: 'Pessoal' },
  { value: 'BILLING', label: 'Cobrança' },
  { value: 'OTHER', label: 'Outro' },
];

const LEAD_STATUS_OPTIONS = [
  'NEW',
  'CONTACTED',
  'ENGAGED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'CONVERTED',
  'LOST',
  'NURTURING',
];

const LEAD_SOURCE_OPTIONS = [
  'ORGANIC',
  'PAID_ADS',
  'SOCIAL_MEDIA',
  'EMAIL',
  'REFERRAL',
  'WHATSAPP',
  'WEBSITE',
  'PHONE',
  'EVENT',
  'PARTNER',
  'IMPORT',
  'OTHER',
];

const formatEnumLabel = (value) =>
  value
    ? value
        .toString()
        .toLowerCase()
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ')
    : '—';

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `R$ ${Number(value).toFixed(2)}`;
  }
};

const toPercentage = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${value}%`;
};

const sanitizeDetails = (details) => (Array.isArray(details) ? details : []);

const derivePrimaryPhone = (phoneDetails) =>
  phoneDetails.find((item) => item.isPrimary)?.phoneNumber ?? phoneDetails[0]?.phoneNumber ?? undefined;

const derivePrimaryEmail = (emailDetails) =>
  emailDetails.find((item) => item.isPrimary)?.email ?? emailDetails[0]?.email ?? undefined;

const rebuildContactPhones = (contact, phoneDetails) => {
  const safeDetails = sanitizeDetails(phoneDetails);
  const primary = derivePrimaryPhone(safeDetails);
  return {
    ...contact,
    phoneDetails: safeDetails,
    phones: safeDetails.map((item) => item.phoneNumber),
    phone: primary ?? contact?.phone ?? undefined,
    primaryPhone: primary ?? contact?.primaryPhone ?? undefined,
  };
};

const rebuildContactEmails = (contact, emailDetails) => {
  const safeDetails = sanitizeDetails(emailDetails);
  const primary = derivePrimaryEmail(safeDetails);
  return {
    ...contact,
    emailDetails: safeDetails,
    emails: safeDetails.map((item) => item.email),
    email: primary ?? contact?.email ?? undefined,
    primaryEmail: primary ?? contact?.primaryEmail ?? undefined,
  };
};

const rebuildContactTags = (contact, assignments) => {
  const safeAssignments = sanitizeDetails(assignments);
  const tags = safeAssignments
    .map((assignment) => assignment?.tag?.name ?? null)
    .filter((name) => typeof name === 'string' && name.length > 0);

  return {
    ...contact,
    tagAssignments: safeAssignments,
    tags,
  };
};

const useTicketsCacheUpdater = (ticketId) => {
  const queryClient = useQueryClient();

  return useCallback(
    (updater) => {
      if (!ticketId || typeof updater !== 'function') {
        return;
      }

      const queries = queryClient.getQueriesData({ queryKey: ['chat', 'tickets'] });
      for (const [queryKey, value] of queries) {
        if (!value || !Array.isArray(value.items)) {
          continue;
        }

        queryClient.setQueryData(queryKey, (current) => {
          if (!current || !Array.isArray(current.items)) {
            return current;
          }

          const items = current.items.map((item) => {
            if (!item || item.id !== ticketId) {
              return item;
            }
            const nextTicket = updater(item);
            return nextTicket ?? item;
          });

          return { ...current, items };
        });
      }

      queryClient.setQueryData(['chat', 'ticket', ticketId], (current) => {
        if (!current) {
          return current;
        }
        const nextTicket = updater(current);
        return nextTicket ?? current;
      });
    },
    [queryClient, ticketId]
  );
};

const DocumentField = ({ contact, onContactChange, updateContactField, isSaving }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(contact?.document ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    setDraft(contact?.document ?? '');
  }, [contact?.document]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const stopEditing = useCallback(() => {
    setEditing(false);
    setDraft(contact?.document ?? '');
  }, [contact?.document]);

  const handleCommit = useCallback(async () => {
    if (!contact?.id) {
      stopEditing();
      return;
    }

    const trimmed = draft.trim();
    const current = contact.document ?? '';

    if (trimmed === current.trim()) {
      stopEditing();
      return;
    }

    try {
      const payload = await updateContactField.mutateAsync({
        data: { document: trimmed || null },
        targetContactId: contact.id,
      });

      const nextContact = {
        ...contact,
        ...(payload ?? {}),
        document: trimmed || undefined,
      };

      onContactChange(nextContact);
      toast.success('Documento atualizado.');
      setEditing(false);
    } catch (error) {
      toast.error(error?.message ?? 'Não foi possível atualizar o documento.');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [contact, draft, onContactChange, stopEditing, updateContactField]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleCommit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        stopEditing();
      }
    },
    [handleCommit, stopEditing]
  );

  if (!contact) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Documento</span>
      {editing ? (
        <Input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          placeholder="Adicionar documento"
          className="h-8 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex h-8 items-center rounded-md border border-transparent px-2 text-left text-sm text-foreground transition hover:border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {contact.document ? contact.document : <span className="text-foreground-muted">Adicionar documento</span>}
        </button>
      )}
    </div>
  );
};

const PhoneRow = ({ phone, onStartEdit, onSetPrimary, onRemove, isProcessing }) => (
  <div className="flex items-start justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-border hover:bg-muted/40">
    <button
      type="button"
      onClick={() => onStartEdit(phone)}
      className="flex flex-1 flex-col items-start text-left focus-visible:outline-none"
    >
      <span className="text-sm font-medium text-foreground">
        {phone.phoneNumber ? formatPhoneNumber(phone.phoneNumber) : 'Sem número'}
      </span>
      <span className="text-xs text-foreground-muted">
        {[phone.label, phone.type ? formatEnumLabel(phone.type) : null]
          .filter(Boolean)
          .join(' · ') || 'Clique para editar'}
      </span>
    </button>
    <div className="flex items-center gap-2">
      {phone.isPrimary ? (
        <Badge variant="secondary" className="px-2 py-0 text-[10px] uppercase tracking-wide">
          Principal
        </Badge>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSetPrimary(phone)}
          disabled={isProcessing}
          className="h-7 px-2 text-xs"
        >
          Definir principal
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(phone)}
        disabled={isProcessing}
        className="h-7 w-7 text-foreground-muted hover:text-destructive"
      >
        {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>
    </div>
  </div>
);

const EmailRow = ({ email, onStartEdit, onSetPrimary, onRemove, isProcessing }) => (
  <div className="flex items-start justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-border hover:bg-muted/40">
    <button
      type="button"
      onClick={() => onStartEdit(email)}
      className="flex flex-1 flex-col items-start text-left focus-visible:outline-none"
    >
      <span className="text-sm font-medium text-foreground">{email.email || 'Sem e-mail'}</span>
      <span className="text-xs text-foreground-muted">
        {[email.label, email.type ? formatEnumLabel(email.type) : null]
          .filter(Boolean)
          .join(' · ') || 'Clique para editar'}
      </span>
    </button>
    <div className="flex items-center gap-2">
      {email.isPrimary ? (
        <Badge variant="secondary" className="px-2 py-0 text-[10px] uppercase tracking-wide">
          Principal
        </Badge>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSetPrimary(email)}
          disabled={isProcessing}
          className="h-7 px-2 text-xs"
        >
          Definir principal
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(email)}
        disabled={isProcessing}
        className="h-7 w-7 text-foreground-muted hover:text-destructive"
      >
        {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>
    </div>
  </div>
);

const EditablePhoneForm = ({ draft, onChange, onCancel, onCommit, saving, inputRef }) => {
  const containerRef = useRef(null);

  const handleBlur = useCallback(
    (event) => {
      const next = event.relatedTarget;
      if (next && containerRef.current?.contains(next)) {
        return;
      }
      onCommit();
    },
    [onCommit]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onCommit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    },
    [onCancel, onCommit]
  );

  return (
    <div
      ref={containerRef}
      className="grid gap-2 rounded-lg border border-border bg-surface px-3 py-2"
      tabIndex={-1}
      onBlur={handleBlur}
    >
      <Input
        ref={inputRef}
        value={draft.phoneNumber}
        onChange={(event) => onChange({ ...draft, phoneNumber: event.target.value })}
        onKeyDown={handleKeyDown}
        placeholder="Número"
        disabled={saving}
        className="h-8 text-sm"
      />
      <div className="flex items-center gap-2">
        <Select
          value={draft.type ?? ''}
          onValueChange={(value) => onChange({ ...draft, type: value || undefined })}
          disabled={saving}
        >
          <SelectTrigger className="h-8 flex-1 text-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Não informado</SelectItem>
            {PHONE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={draft.label ?? ''}
          onChange={(event) => onChange({ ...draft, label: event.target.value })}
          onKeyDown={handleKeyDown}
          disabled={saving}
          placeholder="Etiqueta"
          className="h-8 flex-1 text-sm"
        />
      </div>
    </div>
  );
};

const EditableEmailForm = ({ draft, onChange, onCancel, onCommit, saving, inputRef }) => {
  const containerRef = useRef(null);

  const handleBlur = useCallback(
    (event) => {
      const next = event.relatedTarget;
      if (next && containerRef.current?.contains(next)) {
        return;
      }
      onCommit();
    },
    [onCommit]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onCommit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    },
    [onCancel, onCommit]
  );

  return (
    <div
      ref={containerRef}
      className="grid gap-2 rounded-lg border border-border bg-surface px-3 py-2"
      tabIndex={-1}
      onBlur={handleBlur}
    >
      <Input
        ref={inputRef}
        value={draft.email}
        onChange={(event) => onChange({ ...draft, email: event.target.value })}
        onKeyDown={handleKeyDown}
        placeholder="E-mail"
        disabled={saving}
        className="h-8 text-sm"
      />
      <div className="flex items-center gap-2">
        <Select
          value={draft.type ?? ''}
          onValueChange={(value) => onChange({ ...draft, type: value || undefined })}
          disabled={saving}
        >
          <SelectTrigger className="h-8 flex-1 text-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Não informado</SelectItem>
            {EMAIL_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={draft.label ?? ''}
          onChange={(event) => onChange({ ...draft, label: event.target.value })}
          onKeyDown={handleKeyDown}
          disabled={saving}
          placeholder="Etiqueta"
          className="h-8 flex-1 text-sm"
        />
      </div>
    </div>
  );
};

const TagSelector = ({
  assignment,
  availableTags,
  onSelect,
  onRemove,
  disabled,
  forceOpen = false,
  onRequestClose,
}) => {
  const [open, setOpen] = useState(Boolean(forceOpen));
  const currentName = assignment?.tag?.name ?? assignment?.name ?? null;

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
    }
  }, [forceOpen]);

  const handleOpenChange = useCallback(
    (next) => {
      setOpen(next);
      if (!next) {
        onRequestClose?.();
      }
    },
    [onRequestClose]
  );

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition',
              'border-transparent bg-accent/10 text-accent hover:border-accent/40 hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
            )}
            disabled={disabled}
          >
            {currentName ?? 'Selecionar tag'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar tag..." />
            <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
            <CommandGroup>
              {availableTags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.id}
                  onSelect={() => {
                    onSelect(tag);
                    setOpen(false);
                    onRequestClose?.();
                  }}
                >
                  {tag.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      {assignment?.id ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-foreground-muted hover:text-destructive"
          onClick={() => {
            onRemove(assignment);
            onRequestClose?.();
          }}
          disabled={disabled}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
};

const AsyncUserSelect = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = useSearchUsersQuery({ search, enabled: open });
  const items = Array.isArray(query.data) ? query.data : [];

  const handleSelect = useCallback(
    (item) => {
      onChange(item);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 justify-between text-sm"
          disabled={disabled}
        >
          <span className="truncate">{value?.name ?? value?.email ?? 'Selecionar dono'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar usuário..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>
            {query.isLoading ? 'Carregando...' : 'Nenhum usuário encontrado.'}
          </CommandEmpty>
          <CommandGroup>
            <CommandItem
              value="__none__"
              onSelect={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Sem dono
            </CommandItem>
            {items.map((item) => (
              <CommandItem key={item.id} value={item.id} onSelect={() => handleSelect(item)}>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{item.name ?? item.email}</span>
                  {item.email ? <span className="text-xs text-foreground-muted">{item.email}</span> : null}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const CampaignSelect = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = useCampaignsLookupQuery({ search, enabled: open });
  const campaigns = Array.isArray(query.data) ? query.data : [];

  const handleSelect = useCallback(
    (campaign) => {
      onChange(campaign);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 justify-between text-sm"
          disabled={disabled}
        >
          <span className="truncate">{value?.name ?? 'Selecionar campanha'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar campanha..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>
            {query.isLoading ? 'Carregando...' : 'Nenhuma campanha encontrada.'}
          </CommandEmpty>
          <CommandGroup>
            <CommandItem
              value="__none__"
              onSelect={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Sem campanha
            </CommandItem>
            {campaigns.map((campaign) => (
              <CommandItem key={campaign.id} value={campaign.id} onSelect={() => handleSelect(campaign)}>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{campaign.name}</span>
                  {campaign.agreementName || campaign.agreementId ? (
                    <span className="text-xs text-foreground-muted">
                      {campaign.agreementName ?? `Convênio ${campaign.agreementId}`}
                    </span>
                  ) : null}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const LeadDetailsTabs = ({ ticket }) => {
  const ticketId = ticket?.id ?? null;
  const contact = ticket?.contact ?? null;
  const lead = ticket?.lead ?? null;

  const [activeTab, setActiveTab] = useState('contact');
  const [localContact, setLocalContact] = useState(contact ?? null);
  const [localLead, setLocalLead] = useState(lead ?? null);

  useEffect(() => {
    setLocalContact(contact ?? null);
  }, [contact]);

  useEffect(() => {
    setLocalLead(lead ?? null);
  }, [lead]);

  const updateTicketCache = useTicketsCacheUpdater(ticketId);

  const handleContactChange = useCallback(
    (nextContact) => {
      setLocalContact(nextContact);
      if (!ticketId) {
        return;
      }
      updateTicketCache((current) => ({ ...current, contact: nextContact }));
    },
    [ticketId, updateTicketCache]
  );

  const handleLeadChange = useCallback(
    (nextLead) => {
      setLocalLead(nextLead);
      if (!ticketId) {
        return;
      }
      updateTicketCache((current) => ({ ...current, lead: nextLead }));
    },
    [ticketId, updateTicketCache]
  );

  const updateContactField = useUpdateContactField({ contactId: contact?.id });
  const upsertContactPhone = useUpsertContactPhone({ contactId: contact?.id });
  const deleteContactPhone = useDeleteContactPhone({ contactId: contact?.id });
  const upsertContactEmail = useUpsertContactEmail({ contactId: contact?.id });
  const deleteContactEmail = useDeleteContactEmail({ contactId: contact?.id });
  const upsertContactTag = useUpsertContactTag({ contactId: contact?.id });
  const deleteContactTag = useDeleteContactTag({ contactId: contact?.id });
  const updateLeadField = useUpdateLeadField({ leadId: lead?.id });

  const tagsQuery = useListContactTagsQuery({ enabled: Boolean(contact?.id) });
  const availableTags = useMemo(() => (Array.isArray(tagsQuery.data) ? tagsQuery.data : []), [
    tagsQuery.data,
  ]);

  const [phoneEditingId, setPhoneEditingId] = useState(null);
  const [phoneDraft, setPhoneDraft] = useState({ phoneNumber: '', type: undefined, label: '', isPrimary: false });
  const [emailEditingId, setEmailEditingId] = useState(null);
  const [emailDraft, setEmailDraft] = useState({ email: '', type: undefined, label: '', isPrimary: false });
  const [tagEditingId, setTagEditingId] = useState(null);
  const phoneInputRef = useRef(null);
  const emailInputRef = useRef(null);

  const handleStartEditPhone = useCallback((phone) => {
    if (!phone) {
      return;
    }
    setPhoneEditingId(phone.id);
    setPhoneDraft({
      phoneNumber: phone.phoneNumber ?? '',
      type: phone.type ?? undefined,
      label: phone.label ?? '',
      isPrimary: Boolean(phone.isPrimary),
    });
  }, []);

  const handleStartCreatePhone = useCallback(() => {
    if (!localContact) {
      return;
    }
    const tempId = `temp-phone-${Date.now()}`;
    const nextDetails = [
      ...sanitizeDetails(localContact.phoneDetails),
      {
        id: tempId,
        contactId: localContact.id,
        phoneNumber: '',
        type: undefined,
        label: undefined,
        isPrimary: sanitizeDetails(localContact.phoneDetails).length === 0,
      },
    ];
    const nextContact = rebuildContactPhones(localContact, nextDetails);
    setLocalContact(nextContact);
    setPhoneEditingId(tempId);
    setPhoneDraft({ phoneNumber: '', type: undefined, label: '', isPrimary: nextDetails[nextDetails.length - 1]?.isPrimary ?? false });
  }, [localContact]);

  const handleCancelPhoneEdit = useCallback(() => {
    const editingId = phoneEditingId;
    setPhoneEditingId(null);
    setPhoneDraft({ phoneNumber: '', type: undefined, label: '', isPrimary: false });

    if (editingId && editingId.startsWith('temp-') && localContact) {
      const remaining = sanitizeDetails(localContact.phoneDetails).filter((item) => item.id !== editingId);
      const nextContact = rebuildContactPhones(localContact, remaining);
      setLocalContact(nextContact);
    }
  }, [localContact, phoneEditingId]);

  const handleCommitPhone = useCallback(async () => {
    if (!contact?.id) {
      handleCancelPhoneEdit();
      return;
    }

    const editingId = phoneEditingId;
    const draft = phoneDraft;
    const trimmed = draft.phoneNumber.trim();

    if (!trimmed) {
      toast.error('Informe um número válido.');
      requestAnimationFrame(() => phoneInputRef.current?.focus());
      return;
    }

    const payloadData = {
      phoneNumber: trimmed,
      type: draft.type ?? undefined,
      label: draft.label?.trim() ? draft.label.trim() : undefined,
      isPrimary: Boolean(draft.isPrimary),
    };

    try {
      const result = await upsertContactPhone.mutateAsync({
        phoneId: editingId && !editingId.startsWith('temp-') ? editingId : null,
        targetContactId: contact.id,
        data: payloadData,
      });

      const createdPhone = result ?? {
        id: editingId ?? `phone-${Date.now()}`,
        contactId: contact.id,
        ...payloadData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const currentDetails = sanitizeDetails(localContact?.phoneDetails);
      const filtered = currentDetails.filter((item) => item.id !== editingId);
      const merged = [...filtered, createdPhone];

      const normalized = merged.map((item) =>
        item.id === createdPhone.id
          ? { ...item, isPrimary: payloadData.isPrimary }
          : { ...item, isPrimary: payloadData.isPrimary ? false : item.isPrimary }
      );

      const nextContact = rebuildContactPhones(localContact ?? contact, normalized);
      handleContactChange(nextContact);
      toast.success('Telefone atualizado.');
      setPhoneEditingId(null);
    } catch (error) {
      toast.error(error?.message ?? 'Não foi possível salvar o telefone.');
      requestAnimationFrame(() => phoneInputRef.current?.focus());
    }
  }, [
    contact,
    handleCancelPhoneEdit,
    handleContactChange,
    localContact,
    phoneDraft,
    phoneEditingId,
    upsertContactPhone,
  ]);

  const handleSetPrimaryPhone = useCallback(
    async (phone) => {
      if (!phone?.id || !contact?.id) {
        return;
      }

      try {
        const payload = await upsertContactPhone.mutateAsync({
          phoneId: phone.id,
          targetContactId: contact.id,
          data: {
            phoneNumber: phone.phoneNumber,
            type: phone.type ?? undefined,
            label: phone.label ?? undefined,
            isPrimary: true,
          },
        });

        const resultPhone = payload ?? { ...phone, isPrimary: true };
        const currentDetails = sanitizeDetails(localContact?.phoneDetails).map((item) => ({
          ...item,
          isPrimary: item.id === resultPhone.id,
        }));

        const ensured = currentDetails.some((item) => item.id === resultPhone.id)
          ? currentDetails.map((item) => (item.id === resultPhone.id ? resultPhone : item))
          : [...currentDetails, resultPhone];

        const nextContact = rebuildContactPhones(localContact ?? contact, ensured);
        handleContactChange(nextContact);
        toast.success('Telefone principal atualizado.');
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível atualizar o telefone principal.');
      }
    },
    [contact, handleContactChange, localContact, upsertContactPhone]
  );

  const handleRemovePhone = useCallback(
    async (phone) => {
      if (!phone?.id) {
        return;
      }

      if (phone.id.startsWith('temp-')) {
        const remaining = sanitizeDetails(localContact?.phoneDetails).filter((item) => item.id !== phone.id);
        const nextContact = rebuildContactPhones(localContact ?? contact, remaining);
        setLocalContact(nextContact);
        setPhoneEditingId(null);
        return;
      }

      try {
        await deleteContactPhone.mutateAsync({ phoneId: phone.id, targetContactId: contact?.id });
        const remaining = sanitizeDetails(localContact?.phoneDetails).filter((item) => item.id !== phone.id);
        const nextContact = rebuildContactPhones(localContact ?? contact, remaining);
        handleContactChange(nextContact);
        toast.success('Telefone removido.');
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível remover o telefone.');
      }
    },
    [contact, deleteContactPhone, handleContactChange, localContact]
  );

  const handleStartEditEmail = useCallback((email) => {
    if (!email) {
      return;
    }
    setEmailEditingId(email.id);
    setEmailDraft({
      email: email.email ?? '',
      type: email.type ?? undefined,
      label: email.label ?? '',
      isPrimary: Boolean(email.isPrimary),
    });
  }, []);

  const handleStartCreateEmail = useCallback(() => {
    if (!localContact) {
      return;
    }
    const tempId = `temp-email-${Date.now()}`;
    const nextDetails = [
      ...sanitizeDetails(localContact.emailDetails),
      {
        id: tempId,
        contactId: localContact.id,
        email: '',
        type: undefined,
        label: undefined,
        isPrimary: sanitizeDetails(localContact.emailDetails).length === 0,
      },
    ];
    const nextContact = rebuildContactEmails(localContact, nextDetails);
    setLocalContact(nextContact);
    setEmailEditingId(tempId);
    setEmailDraft({ email: '', type: undefined, label: '', isPrimary: nextDetails[nextDetails.length - 1]?.isPrimary ?? false });
  }, [localContact]);

  const handleCancelEmailEdit = useCallback(() => {
    const editingId = emailEditingId;
    setEmailEditingId(null);
    setEmailDraft({ email: '', type: undefined, label: '', isPrimary: false });

    if (editingId && editingId.startsWith('temp-') && localContact) {
      const remaining = sanitizeDetails(localContact.emailDetails).filter((item) => item.id !== editingId);
      const nextContact = rebuildContactEmails(localContact, remaining);
      setLocalContact(nextContact);
    }
  }, [emailEditingId, localContact]);

  const handleCommitEmail = useCallback(async () => {
    if (!contact?.id) {
      handleCancelEmailEdit();
      return;
    }

    const editingId = emailEditingId;
    const draft = emailDraft;
    const trimmed = draft.email.trim();

    if (!trimmed) {
      toast.error('Informe um e-mail válido.');
      requestAnimationFrame(() => emailInputRef.current?.focus());
      return;
    }

    const payloadData = {
      email: trimmed,
      type: draft.type ?? undefined,
      label: draft.label?.trim() ? draft.label.trim() : undefined,
      isPrimary: Boolean(draft.isPrimary),
    };

    try {
      const result = await upsertContactEmail.mutateAsync({
        emailId: editingId && !editingId.startsWith('temp-') ? editingId : null,
        targetContactId: contact.id,
        data: payloadData,
      });

      const createdEmail = result ?? {
        id: editingId ?? `email-${Date.now()}`,
        contactId: contact.id,
        ...payloadData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const currentDetails = sanitizeDetails(localContact?.emailDetails);
      const filtered = currentDetails.filter((item) => item.id !== editingId);
      const merged = [...filtered, createdEmail];

      const normalized = merged.map((item) =>
        item.id === createdEmail.id
          ? { ...item, isPrimary: payloadData.isPrimary }
          : { ...item, isPrimary: payloadData.isPrimary ? false : item.isPrimary }
      );

      const nextContact = rebuildContactEmails(localContact ?? contact, normalized);
      handleContactChange(nextContact);
      toast.success('E-mail atualizado.');
      setEmailEditingId(null);
    } catch (error) {
      toast.error(error?.message ?? 'Não foi possível salvar o e-mail.');
      requestAnimationFrame(() => emailInputRef.current?.focus());
    }
  }, [
    contact,
    emailDraft,
    emailEditingId,
    handleCancelEmailEdit,
    handleContactChange,
    localContact,
    upsertContactEmail,
  ]);

  const handleSetPrimaryEmail = useCallback(
    async (email) => {
      if (!email?.id || !contact?.id) {
        return;
      }

      try {
        const payload = await upsertContactEmail.mutateAsync({
          emailId: email.id,
          targetContactId: contact.id,
          data: {
            email: email.email,
            type: email.type ?? undefined,
            label: email.label ?? undefined,
            isPrimary: true,
          },
        });

        const resultEmail = payload ?? { ...email, isPrimary: true };
        const currentDetails = sanitizeDetails(localContact?.emailDetails).map((item) => ({
          ...item,
          isPrimary: item.id === resultEmail.id,
        }));

        const ensured = currentDetails.some((item) => item.id === resultEmail.id)
          ? currentDetails.map((item) => (item.id === resultEmail.id ? resultEmail : item))
          : [...currentDetails, resultEmail];

        const nextContact = rebuildContactEmails(localContact ?? contact, ensured);
        handleContactChange(nextContact);
        toast.success('E-mail principal atualizado.');
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível atualizar o e-mail principal.');
      }
    },
    [contact, handleContactChange, localContact, upsertContactEmail]
  );

  const handleRemoveEmail = useCallback(
    async (email) => {
      if (!email?.id) {
        return;
      }

      if (email.id.startsWith('temp-')) {
        const remaining = sanitizeDetails(localContact?.emailDetails).filter((item) => item.id !== email.id);
        const nextContact = rebuildContactEmails(localContact ?? contact, remaining);
        setLocalContact(nextContact);
        setEmailEditingId(null);
        return;
      }

      try {
        await deleteContactEmail.mutateAsync({ emailId: email.id, targetContactId: contact?.id });
        const remaining = sanitizeDetails(localContact?.emailDetails).filter((item) => item.id !== email.id);
        const nextContact = rebuildContactEmails(localContact ?? contact, remaining);
        handleContactChange(nextContact);
        toast.success('E-mail removido.');
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível remover o e-mail.');
      }
    },
    [contact, deleteContactEmail, handleContactChange, localContact]
  );

  const handleTagSelect = useCallback(
    async (assignment, tag) => {
      if (!contact?.id || !tag?.id) {
        return;
      }

      try {
        const payload = await upsertContactTag.mutateAsync({
          assignmentId: assignment?.id ?? null,
          targetContactId: contact.id,
          tagId: tag.id,
        });

        const created = payload ?? {
          id: assignment?.id ?? `tag-${Date.now()}`,
          contactId: contact.id,
          tagId: tag.id,
          tag,
        };

        const currentAssignments = sanitizeDetails(localContact?.tagAssignments);
        const filtered = assignment?.id
          ? currentAssignments.filter((item) => item.id !== assignment.id)
          : currentAssignments;
        const merged = [...filtered, { ...created, tag: created.tag ?? tag }];

        const nextContact = rebuildContactTags(localContact ?? contact, merged);
        handleContactChange(nextContact);
        toast.success('Tag atualizada.');
        setTagEditingId(null);
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível atualizar a tag.');
      }
    },
    [contact, handleContactChange, localContact, upsertContactTag]
  );

  const handleTagRemove = useCallback(
    async (assignment) => {
      if (!assignment?.id) {
        return;
      }
      const isTemporary = assignment.id.startsWith('temp-');
      try {
        if (!isTemporary) {
          await deleteContactTag.mutateAsync({ assignmentId: assignment.id, targetContactId: contact?.id });
        }
        const remaining = sanitizeDetails(localContact?.tagAssignments).filter((item) => item.id !== assignment.id);
        const nextContact = rebuildContactTags(localContact ?? contact, remaining);
        handleContactChange(nextContact);
        toast.success('Tag removida.');
        setTagEditingId(null);
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível remover a tag.');
      }
    },
    [contact, deleteContactTag, handleContactChange, localContact]
  );

  const handleAddTag = useCallback(() => {
    if (!contact?.id) {
      return;
    }
    if (availableTags.length === 0) {
      toast.info('Cadastre tags em Contatos para utilizá-las aqui.');
      return;
    }

    const tempId = `temp-tag-${Date.now()}`;
    const placeholder = { id: tempId, contactId: contact.id, tagId: null, tag: null };
    const nextAssignments = [...sanitizeDetails(localContact?.tagAssignments), placeholder];
    const nextContact = rebuildContactTags(localContact ?? contact, nextAssignments);
    setLocalContact(nextContact);
    setTagEditingId(tempId);
  }, [availableTags, contact, localContact]);

  const handleValueChange = useCallback(
    async (value) => {
      if (!lead?.id) {
        return;
      }

      const numeric = Number(value);
      if (Number.isNaN(numeric)) {
        toast.error('Informe um valor válido.');
        return;
      }

      try {
        const payload = await updateLeadField.mutateAsync({
          targetLeadId: lead.id,
          data: { value: numeric },
        });

        const nextLead = { ...lead, ...(payload ?? {}), value: numeric };
        handleLeadChange(nextLead);
        toast.success('Valor atualizado.');
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível atualizar o valor.');
      }
    },
    [handleLeadChange, lead, updateLeadField]
  );

  const handleProbabilityChange = useCallback(
    async (probability) => {
      if (!lead?.id) {
        return;
      }
      const numeric = Number(probability);
      if (Number.isNaN(numeric) || numeric < 0 || numeric > 100) {
        toast.error('Probabilidade deve estar entre 0 e 100.');
        return;
      }
      try {
        const payload = await updateLeadField.mutateAsync({
          targetLeadId: lead.id,
          data: { probability: numeric },
        });
        const nextLead = { ...lead, ...(payload ?? {}), probability: numeric };
        handleLeadChange(nextLead);
        toast.success('Probabilidade atualizada.');
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível atualizar a probabilidade.');
      }
    },
    [handleLeadChange, lead, updateLeadField]
  );

  const handleStatusChange = useCallback(
    async (status) => {
      if (!lead?.id) {
        return;
      }
      try {
        const payload = await updateLeadField.mutateAsync({
          targetLeadId: lead.id,
          data: { status },
        });
        const nextLead = { ...lead, ...(payload ?? {}), status };
        handleLeadChange(nextLead);
        toast.success('Etapa atualizada.');
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível atualizar a etapa.');
      }
    },
    [handleLeadChange, lead, updateLeadField]
  );

  const handleSourceChange = useCallback(
    async (source) => {
      if (!lead?.id) {
        return;
      }
      try {
        const payload = await updateLeadField.mutateAsync({
          targetLeadId: lead.id,
          data: { source },
        });
        const nextLead = { ...lead, ...(payload ?? {}), source };
        handleLeadChange(nextLead);
        toast.success('Origem atualizada.');
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível atualizar a origem.');
      }
    },
    [handleLeadChange, lead, updateLeadField]
  );

  const handleCampaignChange = useCallback(
    async (campaign) => {
      if (!lead?.id) {
        return;
      }
      try {
        const payload = await updateLeadField.mutateAsync({
          targetLeadId: lead.id,
          data: { campaignId: campaign?.id ?? null },
        });
        const nextLead = {
          ...lead,
          ...(payload ?? {}),
          campaignId: campaign?.id ?? null,
          campaign,
        };
        handleLeadChange(nextLead);
        toast.success('Campanha atualizada.');
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível atualizar a campanha.');
      }
    },
    [handleLeadChange, lead, updateLeadField]
  );

  const handleOwnerChange = useCallback(
    async (user) => {
      if (!lead?.id) {
        return;
      }
      try {
        const payload = await updateLeadField.mutateAsync({
          targetLeadId: lead.id,
          data: { userId: user?.id ?? null },
        });
        const nextLead = {
          ...lead,
          ...(payload ?? {}),
          userId: user?.id ?? null,
          owner: user ?? lead?.owner ?? null,
        };
        handleLeadChange(nextLead);
        toast.success('Dono atualizado.');
      } catch (error) {
        toast.error(error?.message ?? 'Não foi possível atualizar o dono.');
      }
    },
    [handleLeadChange, lead, updateLeadField]
  );

  const isSavingContact =
    updateContactField.isPending ||
    upsertContactPhone.isPending ||
    deleteContactPhone.isPending ||
    upsertContactEmail.isPending ||
    deleteContactEmail.isPending ||
    upsertContactTag.isPending ||
    deleteContactTag.isPending;

  const isSavingLead = updateLeadField.isPending;

  const phoneDetails = sanitizeDetails(localContact?.phoneDetails);
  const emailDetails = sanitizeDetails(localContact?.emailDetails);
  const tagAssignments = sanitizeDetails(localContact?.tagAssignments);

  return (
    <Card className="border-0 bg-surface-overlay-quiet text-foreground shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-surface-overlay-glass-border backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Detalhes</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-3">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="contact" className="flex-1">
              Contato
            </TabsTrigger>
            <TabsTrigger value="opportunity" className="flex-1">
              Oportunidade
            </TabsTrigger>
          </TabsList>
          <TabsContent value="contact" className="flex flex-col gap-4 pt-2">
            {localContact ? (
              <div className="space-y-4">
                <DocumentField
                  contact={localContact}
                  onContactChange={handleContactChange}
                  updateContactField={updateContactField}
                  isSaving={isSavingContact}
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Telefones</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleStartCreatePhone}
                      disabled={isSavingContact}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {phoneDetails.length === 0 ? (
                      <p className="text-xs text-foreground-muted">Nenhum telefone cadastrado.</p>
                    ) : null}
                    {phoneDetails.map((phone) =>
                      phoneEditingId === phone.id ? (
                        <EditablePhoneForm
                          key={phone.id}
                          draft={{ ...phoneDraft, isPrimary: phoneDraft.isPrimary ?? phone.isPrimary }}
                          onChange={(next) => setPhoneDraft(next)}
                          onCancel={handleCancelPhoneEdit}
                          onCommit={handleCommitPhone}
                          saving={isSavingContact}
                          inputRef={phoneInputRef}
                        />
                      ) : (
                        <PhoneRow
                          key={phone.id}
                          phone={phone}
                          onStartEdit={handleStartEditPhone}
                          onSetPrimary={handleSetPrimaryPhone}
                          onRemove={handleRemovePhone}
                          isProcessing={isSavingContact}
                        />
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">E-mails</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleStartCreateEmail}
                      disabled={isSavingContact}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {emailDetails.length === 0 ? (
                      <p className="text-xs text-foreground-muted">Nenhum e-mail cadastrado.</p>
                    ) : null}
                    {emailDetails.map((email) =>
                      emailEditingId === email.id ? (
                        <EditableEmailForm
                          key={email.id}
                          draft={{ ...emailDraft, isPrimary: emailDraft.isPrimary ?? email.isPrimary }}
                          onChange={(next) => setEmailDraft(next)}
                          onCancel={handleCancelEmailEdit}
                          onCommit={handleCommitEmail}
                          saving={isSavingContact}
                          inputRef={emailInputRef}
                        />
                      ) : (
                        <EmailRow
                          key={email.id}
                          email={email}
                          onStartEdit={handleStartEditEmail}
                          onSetPrimary={handleSetPrimaryEmail}
                          onRemove={handleRemoveEmail}
                          isProcessing={isSavingContact}
                        />
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Tags</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleAddTag}
                      disabled={isSavingContact}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tagAssignments.length === 0 ? (
                      <p className="text-xs text-foreground-muted">Nenhuma tag associada.</p>
                    ) : null}
                    {tagAssignments.map((assignment) => (
                      <TagSelector
                        key={assignment.id}
                        assignment={assignment}
                        availableTags={availableTags}
                        onSelect={(tag) => handleTagSelect(assignment, tag)}
                        onRemove={handleTagRemove}
                        disabled={isSavingContact}
                        forceOpen={tagEditingId === assignment.id}
                        onRequestClose={() => {
                          setTagEditingId((current) => (current === assignment.id ? null : current));
                          if (!assignment.tagId) {
                            handleTagRemove(assignment);
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">Nenhum contato associado a este ticket.</p>
            )}
          </TabsContent>

          <TabsContent value="opportunity" className="flex flex-col gap-4 pt-2">
            {localLead ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Valor</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={localLead.value ?? ''}
                      placeholder="0,00"
                      className="h-9 text-sm"
                      onBlur={(event) => handleValueChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleValueChange(event.currentTarget.value);
                        }
                      }}
                      disabled={isSavingLead}
                    />
                    <span className="text-xs text-foreground-muted">Atual: {formatCurrency(localLead.value)}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Probabilidade</span>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={localLead.probability ?? ''}
                      placeholder="0"
                      className="h-9 text-sm"
                      onBlur={(event) => handleProbabilityChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleProbabilityChange(event.currentTarget.value);
                        }
                      }}
                      disabled={isSavingLead}
                    />
                    <span className="text-xs text-foreground-muted">Atual: {toPercentage(localLead.probability)}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Etapa</span>
                    <Select
                      value={localLead.status ?? ''}
                      onValueChange={handleStatusChange}
                      disabled={isSavingLead}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecionar etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {formatEnumLabel(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Origem</span>
                    <Select
                      value={localLead.source ?? ''}
                      onValueChange={handleSourceChange}
                      disabled={isSavingLead}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecionar origem" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCE_OPTIONS.map((source) => (
                          <SelectItem key={source} value={source}>
                            {formatEnumLabel(source)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Campanha</span>
                    <CampaignSelect
                      value={localLead.campaign ?? null}
                      onChange={handleCampaignChange}
                      disabled={isSavingLead}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Dono</span>
                    <AsyncUserSelect
                      value={localLead.owner ?? null}
                      onChange={handleOwnerChange}
                      disabled={isSavingLead}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">Nenhuma oportunidade vinculada ao lead.</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default LeadDetailsTabs;
