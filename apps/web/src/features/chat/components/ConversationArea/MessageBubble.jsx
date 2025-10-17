import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import {
  Check,
  CheckCheck,
  BadgeCheck,
  AlertTriangle,
  Download,
  FileText,
  MapPin,
  Phone,
  ListChecks,
} from 'lucide-react';

const STATUS_ICONS = {
  PENDING: { icon: Check, tone: 'text-foreground-muted', label: 'Pendente' },
  SENT: { icon: Check, tone: 'text-foreground-muted', label: 'Enviado' },
  DELIVERED: { icon: CheckCheck, tone: 'text-foreground', label: 'Entregue' },
  READ: { icon: BadgeCheck, tone: 'text-success', label: 'Lido' },
  FAILED: { icon: AlertTriangle, tone: 'text-status-error', label: 'Falha no envio' },
};

const formatTime = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const MessageBubble = ({ message }) => {
  const rawDirection = typeof message.direction === 'string' ? message.direction.toLowerCase() : 'inbound';
  const outbound = rawDirection === 'outbound';
  const tone = outbound
    ? 'bg-inbox-surface-strong text-inbox-foreground ring-1 ring-inbox-border'
    : 'bg-inbox-surface text-inbox-foreground ring-1 ring-inbox-border';
  const bubbleClass = cn(
    'max-w-[75%] rounded-[26px] px-4 py-3 text-sm leading-relaxed shadow-[0_20px_45px_-32px_rgba(15,23,42,0.9)] backdrop-blur',
    tone,
    outbound ? 'self-end rounded-tr-sm' : 'self-start rounded-tl-sm'
  );
  const metadata = (message.metadata && typeof message.metadata === 'object' ? message.metadata : {}) ?? {};
  const brokerMetadata = metadata?.broker && typeof metadata.broker === 'object' ? metadata.broker : {};
  const rawKeyMeta = metadata.rawKey && typeof metadata.rawKey === 'object' ? metadata.rawKey : {};
  const sourceInstance = metadata.sourceInstance ?? brokerMetadata.instanceId ?? message.instanceId ?? 'desconhecido';
  const remoteJid = metadata.remoteJid ?? metadata.chatId ?? rawKeyMeta.remoteJid ?? null;
  const phoneLabel = metadata.phoneE164 ?? remoteJid ?? message.chatId ?? 'desconhecido';
  const originChipTone = outbound
    ? 'border border-accent bg-accent text-accent-foreground'
    : 'border-success-soft-border bg-success-soft text-success-strong';
  const directionChipTone = outbound
    ? 'bg-accent text-accent-foreground'
    : 'bg-success-soft text-success-strong';
  const directionLabel = outbound ? 'OUT' : 'IN';
  const timestamp = message.createdAt ? new Date(message.createdAt) : null;
  const tooltipTimestamp = timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toISOString() : null;

  const ack = STATUS_ICONS[message.status ?? 'SENT'] ?? STATUS_ICONS.SENT;

  const messageType = typeof message.type === 'string' ? message.type.toLowerCase() : 'text';
  const media = message.media && typeof message.media === 'object' ? message.media : null;
  const mediaUrl = message.mediaUrl ?? media?.url ?? null;
  const mediaType =
    typeof message.mediaType === 'string'
      ? message.mediaType.toLowerCase()
      : typeof media?.mediaType === 'string'
        ? media.mediaType.toLowerCase()
        : null;
  const caption =
    typeof message.caption === 'string' && message.caption.trim().length > 0
      ? message.caption
      : typeof media?.caption === 'string'
        ? media.caption
        : null;
  const textContent =
    typeof message.text === 'string' && message.text.trim().length > 0
      ? message.text
      : typeof message.content === 'string'
        ? message.content
        : '';

  const resolvedType = messageType === 'media' && mediaType ? mediaType : messageType;

  const resolveFileName = () => {
    if (typeof message.fileName === 'string' && message.fileName.trim().length > 0) {
      return message.fileName;
    }
    if (typeof media?.fileName === 'string' && media.fileName.trim().length > 0) {
      return media.fileName;
    }
    if (typeof metadata?.fileName === 'string' && metadata.fileName.trim().length > 0) {
      return metadata.fileName;
    }
    if (typeof metadata?.documentName === 'string' && metadata.documentName.trim().length > 0) {
      return metadata.documentName;
    }
    if (typeof metadata?.mediaName === 'string' && metadata.mediaName.trim().length > 0) {
      return metadata.mediaName;
    }
    if (typeof mediaUrl === 'string') {
      try {
        const url = new URL(mediaUrl);
        return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? 'arquivo');
      } catch (error) {
        return mediaUrl.split('/').filter(Boolean).pop() ?? 'arquivo';
      }
    }
    return 'arquivo';
  };

  const renderUnsupported = (typeLabel) => (
    <span className="text-xs opacity-60">Mensagem não suportada ({typeLabel || 'desconhecida'})</span>
  );

  const renderBody = () => {
    if (resolvedType === 'text') {
      return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{textContent}</p>;
    }

    if (resolvedType === 'image' && mediaUrl) {
      return (
        <figure className="flex flex-col gap-2">
          <img
            src={mediaUrl}
            alt={caption ?? 'Imagem recebida'}
            className="max-h-64 w-full rounded-lg object-contain"
          />
          {caption ? <figcaption className="text-xs text-foreground-muted">{caption}</figcaption> : null}
        </figure>
      );
    }

    if (resolvedType === 'video') {
      if (!mediaUrl) {
        return renderUnsupported('vídeo');
      }

      return (
        <figure className="flex flex-col gap-2">
          <video
            controls
            src={mediaUrl}
            className="max-h-64 w-full overflow-hidden rounded-lg"
            preload="metadata"
          />
          {caption ? <figcaption className="text-xs text-foreground-muted">{caption}</figcaption> : null}
        </figure>
      );
    }

    if (resolvedType === 'audio') {
      if (!mediaUrl) {
        return renderUnsupported('áudio');
      }

      return (
        <div className="flex flex-col gap-2">
          <audio controls src={mediaUrl} className="w-full" preload="metadata" />
          {caption ? <p className="text-xs text-foreground-muted">{caption}</p> : null}
        </div>
      );
    }

    if (resolvedType === 'document') {
      const fileName = resolveFileName();

      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-surface-overlay-quiet px-3 py-2">
            <FileText className="h-4 w-4 text-foreground" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{fileName}</span>
              <span className="text-xs text-foreground-muted">Documento</span>
            </div>
          </div>
          {mediaUrl ? (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-surface-overlay-quiet px-3 py-1 text-xs font-medium text-foreground transition hover:bg-surface-overlay-strong"
            >
              <Download className="h-3 w-3" aria-hidden="true" />
              Baixar arquivo
            </a>
          ) : (
            <span className="text-xs opacity-60">Pré-visualização indisponível</span>
          )}
          {caption ? <p className="text-xs text-foreground-muted">{caption}</p> : null}
        </div>
      );
    }

    if (resolvedType === 'location') {
      const location = metadata && typeof metadata.location === 'object' ? metadata.location : {};
      const latitude = typeof location.latitude === 'number' ? location.latitude : location.lat;
      const longitude = typeof location.longitude === 'number' ? location.longitude : location.lng;
      const mapsUrl =
        typeof location.url === 'string'
          ? location.url
          : typeof latitude === 'number' && typeof longitude === 'number'
            ? `https://www.google.com/maps?q=${latitude},${longitude}`
            : null;

      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg bg-surface-overlay-quiet px-3 py-2">
            <MapPin className="mt-0.5 h-4 w-4 text-foreground" aria-hidden="true" />
            <div className="flex flex-col">
              {location.name ? <span className="font-semibold text-foreground">{location.name}</span> : null}
              {location.address ? (
                <span className="text-xs text-foreground-muted">{location.address}</span>
              ) : null}
              {typeof latitude === 'number' && typeof longitude === 'number' ? (
                <span className="text-[10px] uppercase tracking-wide text-foreground-muted">
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </span>
              ) : null}
            </div>
          </div>
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-surface-overlay-quiet px-3 py-1 text-xs font-medium text-foreground transition hover:bg-surface-overlay-strong"
            >
              <MapPin className="h-3 w-3" aria-hidden="true" />
              Abrir no mapa
            </a>
          ) : (
            <span className="text-xs opacity-60">Link de mapa indisponível</span>
          )}
          {caption ? <p className="text-xs text-foreground-muted">{caption}</p> : null}
        </div>
      );
    }

    if (resolvedType === 'contact') {
      const contacts = Array.isArray(metadata?.contacts)
        ? metadata.contacts
        : Array.isArray(metadata?.interactive?.contacts)
          ? metadata.interactive.contacts
          : [];

      if (contacts.length === 0) {
        return renderUnsupported('contato');
      }

      return (
        <div className="flex flex-col gap-2">
          {contacts.map((contact, index) => {
            const name = contact?.name ?? contact?.fullName ?? contact?.displayName ?? 'Contato';
            const phones = Array.isArray(contact?.phones) ? contact.phones : contact?.phone ? [contact.phone] : [];

            return (
              <div
                key={`${name}-${index}`}
                className="flex flex-col gap-1 rounded-lg bg-surface-overlay-quiet px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground">{name}</span>
                </div>
                {phones.length > 0 ? (
                  <ul className="ml-5 list-disc text-xs text-foreground-muted">
                    {phones.map((phone, phoneIndex) => (
                      <li key={`${name}-${phoneIndex}`}>{phone}</li>
                    ))}
                  </ul>
                ) : null}
                {contact?.org ? (
                  <span className="text-xs text-foreground-muted">{contact.org}</span>
                ) : null}
              </div>
            );
          })}
          {caption ? <p className="text-xs text-foreground-muted">{caption}</p> : null}
        </div>
      );
    }

    if (resolvedType === 'template') {
      const interactiveTemplate =
        (metadata?.interactive && typeof metadata.interactive === 'object'
          ? metadata.interactive.template
          : null) ?? metadata?.template;

      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1 rounded-lg bg-surface-overlay-quiet px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
              Mensagem modelo
            </span>
            {interactiveTemplate?.name ? (
              <span className="text-sm font-medium text-foreground">{interactiveTemplate.name}</span>
            ) : null}
            {interactiveTemplate?.language ? (
              <span className="text-xs text-foreground-muted">Idioma: {interactiveTemplate.language}</span>
            ) : null}
            {Array.isArray(interactiveTemplate?.components) && interactiveTemplate.components.length > 0 ? (
              <ul className="ml-4 list-disc text-xs text-foreground-muted">
                {interactiveTemplate.components.map((component, index) => (
                  <li key={`component-${index}`}>
                    {component?.type ?? 'Componente'}
                    {component?.text ? `: ${component.text}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {caption ? <p className="text-xs text-foreground-muted">{caption}</p> : null}
        </div>
      );
    }

    if (resolvedType === 'poll') {
      const poll =
        (metadata?.interactive && typeof metadata.interactive === 'object'
          ? metadata.interactive.poll
          : null) ?? metadata?.poll;

      if (!poll) {
        return renderUnsupported('enquete');
      }

      const pollTitle = poll.title ?? poll.name ?? 'Enquete';
      const pollOptions = Array.isArray(poll.options) ? poll.options : [];

      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            {pollTitle}
          </div>
          {pollOptions.length > 0 ? (
            <ul className="ml-5 list-disc space-y-1 text-xs text-foreground-muted">
              {pollOptions.map((option, index) => {
                const label = option?.title ?? option?.name ?? option?.text ?? `Opção ${index + 1}`;
                const votes =
                  typeof option?.votes === 'number'
                    ? option.votes
                    : typeof option?.count === 'number'
                      ? option.count
                      : null;
                return (
                  <li key={`poll-option-${index}`} className="flex items-center gap-2">
                    <span>{label}</span>
                    {votes !== null ? (
                      <span className="rounded-full bg-surface-overlay-quiet px-2 py-0.5 text-[10px] text-foreground">
                        {votes} voto{votes === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className="text-xs opacity-60">Nenhuma opção disponível</span>
          )}
          {typeof poll.totalVotes === 'number' ? (
            <span className="text-[10px] uppercase tracking-wide text-foreground-muted">
              Total de votos: {poll.totalVotes}
            </span>
          ) : null}
          {caption ? <p className="text-xs text-foreground-muted">{caption}</p> : null}
        </div>
      );
    }

    if (mediaUrl && mediaType === 'image') {
      return (
        <figure className="flex flex-col gap-2">
          <img
            src={mediaUrl}
            alt={caption ?? 'Imagem recebida'}
            className="max-h-64 w-full rounded-lg object-contain"
          />
          {caption ? <figcaption className="text-xs text-foreground-muted">{caption}</figcaption> : null}
        </figure>
      );
    }

    if (mediaUrl) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-surface-overlay-quiet px-3 py-2">
            <Download className="h-4 w-4 text-foreground" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">Baixar conteúdo</span>
          </div>
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-surface-overlay-quiet px-3 py-1 text-xs font-medium text-foreground transition hover:bg-surface-overlay-strong"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            Abrir arquivo
          </a>
          {caption ? <p className="text-xs text-foreground-muted">{caption}</p> : null}
        </div>
      );
    }

    return renderUnsupported(resolvedType);
  };

  return (
    <div className={cn('flex w-full flex-col gap-1', outbound ? 'items-end' : 'items-start')}>
      <div className={bubbleClass}>
        <div className={cn('mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide', outbound ? 'justify-end' : 'justify-start')}>
          <span className={cn('rounded-full px-2 py-0.5', directionChipTone)}>{directionLabel}</span>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span className={cn('rounded-full px-2 py-0.5 lowercase normal-case', originChipTone)}>
                {`via ${sourceInstance} • ${phoneLabel}`}
              </span>
            </TooltipTrigger>
            <TooltipContent className="space-y-1">
              <p className="font-semibold">Instância: {sourceInstance}</p>
              {remoteJid ? <p className="text-xs text-muted-foreground">remoteJid: {remoteJid}</p> : null}
              {tooltipTimestamp ? (
                <p className="text-xs text-muted-foreground">timestamp: {tooltipTimestamp}</p>
              ) : null}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="break-words text-sm leading-relaxed">{renderBody()}</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-foreground-muted">
          <span>{formatTime(message.createdAt)}</span>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  ack.tone
                )}
                aria-label={ack.label}
              >
                <ack.icon className="h-3 w-3" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{ack.label}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
