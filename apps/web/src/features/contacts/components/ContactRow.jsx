import { memo, useMemo } from 'react';
import { Phone, Mail, MessageCircle, CheckSquare, CalendarPlus } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';

const resolveInitials = (name) => {
  if (!name) {
    return 'CT';
  }

  const parts = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'CT';
  }

  return parts
    .map((part) => part[0]?.toUpperCase())
    .join('');
};

const formatDate = (value) => {
  if (!value) {
    return '—';
  }
  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  } catch {
    return '—';
  }
};

const ContactRowComponent = ({
  contact,
  selected = false,
  onToggle,
  onOpenDetails,
  onTriggerWhatsApp,
  onCreateTask,
}) => {
  const tags = useMemo(() => (Array.isArray(contact?.tags) ? contact.tags : []), [contact?.tags]);
  const labelId = contact?.id ? `contact-${contact.id}-name` : undefined;

  return (
    <div
      className={cn(
        'grid grid-cols-[auto,1fr,200px] items-center gap-4 border-b border-border/60 px-4 py-3 transition-colors hover:bg-muted/50',
        selected && 'bg-primary/5'
      )}
      role="row"
      aria-selected={selected}
    >
      <div className="flex items-center gap-3" role="gridcell">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={labelId ? undefined : `Selecionar ${contact?.name ?? 'contato'}`}
          aria-labelledby={labelId}
        />
        <Avatar className="h-10 w-10">
          <AvatarFallback>{resolveInitials(contact?.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <button
            type="button"
            className="block text-left text-sm font-semibold text-foreground hover:underline"
            id={labelId}
            onClick={onOpenDetails}
          >
            {contact?.name ?? 'Contato sem nome'}
          </button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {contact?.phone ?? '—'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              {contact?.email ?? '—'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="gridcell">
        {tags.length === 0 ? <Badge variant="outline">Sem tags</Badge> : null}
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>
      <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground" role="gridcell">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onTriggerWhatsApp}
            aria-label="Enviar mensagem no WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCreateTask}
            aria-label="Criar tarefa"
          >
            <CalendarPlus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <CheckSquare className="h-3.5 w-3.5" />
          Último contato: {formatDate(contact?.lastInteractionAt)}
        </div>
      </div>
    </div>
  );
};

const ContactRow = memo(ContactRowComponent);

export default ContactRow;
