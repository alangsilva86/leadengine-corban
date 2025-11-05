import { Suspense, lazy } from 'react';

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
  Loader2,
} from 'lucide-react';

import { usePollMessage } from '../../hooks/usePollMessage.js';

const PollVoteBubble = lazy(() => import('./PollVoteBubble.jsx'));
const ContactBubble = lazy(() => import('./ContactBubble.jsx'));
const TemplateBubble = lazy(() => import('./TemplateBubble.jsx'));

const STATUS_ICONS = {
  PENDING: { icon: Loader2, tone: 'text-foreground-muted', label: 'Enviando' },
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

export const MessageBubble = ({
  message,
  isContinuation = false,
  isTail = true,
  isFirst = false,
  showMetadata = true,
}) => {
  const rawDirection = typeof message.direction === 'string' ? message.direction.toLowerCase() : 'inbound';
  const outbound = rawDirection === 'outbound';
  const tone = outbound
    ? 'bg-inbox-surface-strong text-inbox-foreground ring-1 ring-inbox-border'
    : 'bg-inbox-surface text-inbox-foreground ring-1 ring-inbox-border';
  const bubbleClass = cn(
    'max-w-[72%] rounded-2xl px-3 py-2 text-sm leading-tight shadow-[0_10px_30px_-18px_rgba(15,23,42,0.6)] backdrop-blur transition-colors duration-150',
    tone,
    outbound ? 'self-end' : 'self-start',
    isContinuation && (outbound ? 'rounded-tr-md' : 'rounded-tl-md'),
    !isTail && (outbound ? 'rounded-br-md' : 'rounded-bl-md')
  );
  const containerClass = cn(
    'flex w-full flex-col gap-0.5',
    outbound ? 'items-end' : 'items-start',
    isContinuation ? 'mt-1' : isFirst ? 'mt-0' : 'mt-3'
  );
  const metadata = (message.metadata && typeof message.metadata === 'object' ? message.metadata : {}) ?? {};
  const mediaPending =
    metadata.media_pending === true ||
    (typeof metadata.mediaStatus === 'string' && metadata.mediaStatus.toLowerCase() === 'pending');
  const brokerMetadata = metadata?.broker && typeof metadata.broker === 'object' ? metadata.broker : {};
  const interactiveMetadata =
    metadata?.interactive && typeof metadata.interactive === 'object' ? metadata.interactive : null;
  const rawKeyMeta = metadata.rawKey && typeof metadata.rawKey === 'object' ? metadata.rawKey : {};
  const sourceInstance = metadata.sourceInstance ?? brokerMetadata.instanceId ?? message.instanceId ?? 'desconhecido';
  const remoteJid = metadata.remoteJid ?? metadata.chatId ?? rawKeyMeta.remoteJid ?? null;
  const phoneLabel = metadata.phoneE164 ?? remoteJid ?? message.chatId ?? 'desconhecido';
  const originChipTone = outbound
    ? 'border border-accent bg-accent text-accent-foreground'
    : 'border border-success-soft-border bg-success-strong text-white';
  const directionChipTone = outbound
    ? 'bg-accent text-accent-foreground'
    : 'bg-success-strong text-white';
  const directionLabel = outbound ? 'OUT' : 'IN';
  const timestamp = message.createdAt ? new Date(message.createdAt) : null;
  const tooltipTimestamp = timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toISOString() : null;

  const ack = STATUS_ICONS[message.status ?? 'SENT'] ?? STATUS_ICONS.SENT;
  const AckIcon = ack.icon;
  const normalizedStatus = typeof message.status === 'string' ? message.status.toUpperCase() : 'SENT';
  const isPendingStatus = normalizedStatus === 'PENDING';
  const isFailedStatus = normalizedStatus === 'FAILED';

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
  const structuredTextContent =
    message &&
    message.content &&
    typeof message.content === 'object' &&
    typeof message.content.text === 'string' &&
    message.content.text.trim().length > 0
      ? message.content.text
      : null;

  const rawTextContentCandidate =
    typeof message.text === 'string' && message.text.trim().length > 0
      ? message.text
      : structuredTextContent ??
        (typeof message.content === 'string'
          ? message.content
          : '');

  const rawTextContent = typeof rawTextContentCandidate === 'string' ? rawTextContentCandidate : '';
  const pollState = usePollMessage({ message, messageType, rawTextContent });
  const { textContent, shouldForceText, voteBubble, pollBubble } = pollState;

  const effectiveMessageType = shouldForceText ? 'text' : messageType;

  const resolvedType = effectiveMessageType === 'media' && mediaType ? mediaType : effectiveMessageType;

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

  const renderDownloadAction = (label = 'Baixar arquivo') =>
    mediaUrl ? (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex w-fit items-center gap-2 rounded-full bg-surface-overlay-quiet px-3 py-1 text-xs font-medium text-foreground transition hover:bg-surface-overlay-strong"
      >
        <Download className="h-3 w-3" aria-hidden="true" />
        {label}
      </a>
    ) : null;

  const renderBody = () => {
    if (resolvedType === 'text' && voteBubble?.shouldRender) {
      return (
        <Suspense fallback={<span className="text-xs text-foreground-muted">Carregando enquete…</span>}>
          <PollVoteBubble
            variant="vote"
            question={voteBubble.question}
            pollId={voteBubble.pollId}
            totalVotes={voteBubble.totalVotes}
            totalVoters={voteBubble.totalVoters}
            updatedAtIso={voteBubble.updatedAtIso}
            selectedOptions={voteBubble.selectedOptions}
            textContent={voteBubble.textContent}
            caption={null}
          />
        </Suspense>
      );
    }

    if (resolvedType === 'poll' && pollBubble?.shouldRender) {
      return (
        <Suspense fallback={<span className="text-xs text-foreground-muted">Carregando enquete…</span>}>
          <PollVoteBubble
            variant="poll"
            title={pollBubble.title}
            options={pollBubble.options}
            totalVotes={pollBubble.totalVotes}
            totalVoters={pollBubble.totalVoters}
            caption={caption}
            isMetadataMissing={pollBubble.isMetadataMissing}
          />
        </Suspense>
      );
    }

    if (resolvedType === 'text') {
      return <p className="whitespace-pre-wrap break-words text-sm leading-tight">{textContent}</p>;
    }

    if (mediaPending) {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-surface-overlay-quiet px-3 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-foreground-muted" aria-hidden="true" />
          <span className="text-xs text-foreground-muted">Processando mídia…</span>
        </div>
      );
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
          {renderDownloadAction('Baixar imagem')}
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
          {renderDownloadAction('Baixar vídeo')}
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
          {renderDownloadAction('Baixar áudio')}
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
          {mediaUrl ? renderDownloadAction('Baixar arquivo') : (
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
        <Suspense fallback={<span className="text-xs text-foreground-muted">Carregando contatos…</span>}>
          <ContactBubble contacts={contacts} caption={caption} />
        </Suspense>
      );
    }

    if (resolvedType === 'template') {
      const interactiveTemplate =
        (metadata?.interactive && typeof metadata.interactive === 'object'
          ? metadata.interactive.template
          : null) ?? metadata?.template;

      return (
        <Suspense fallback={<span className="text-xs text-foreground-muted">Carregando template…</span>}>
          <TemplateBubble template={interactiveTemplate} caption={caption} />
        </Suspense>
      );
    }

    if (mediaUrl) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-surface-overlay-quiet px-3 py-2">
            <Download className="h-4 w-4 text-foreground" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">Baixar conteúdo</span>
          </div>
          {renderDownloadAction('Abrir arquivo')}
          {caption ? <p className="text-xs text-foreground-muted">{caption}</p> : null}
        </div>
      );
    }

    return renderUnsupported(resolvedType);
  };

  return (
    <div
      className={containerClass}
      data-direction={outbound ? 'outbound' : 'inbound'}
      data-status={(message.status ?? 'sent').toString().toLowerCase()}
    >
      <div className={bubbleClass}>
        {showMetadata ? (
          <div
            className={cn(
              'mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide',
              outbound ? 'justify-end' : 'justify-start'
            )}
          >
            <span className={cn('rounded-full px-2 py-0.5', directionChipTone)}>{directionLabel}</span>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium normal-case',
                    originChipTone
                  )}
                >
                  via {sourceInstance}
                </span>
              </TooltipTrigger>
              <TooltipContent className="space-y-1">
                <p className="font-semibold">Instância: {sourceInstance}</p>
                <p className="text-xs text-muted-foreground">Contato: {phoneLabel}</p>
                {remoteJid ? <p className="text-xs text-muted-foreground">remoteJid: {remoteJid}</p> : null}
                {tooltipTimestamp ? (
                  <p className="text-xs text-muted-foreground">timestamp: {tooltipTimestamp}</p>
                ) : null}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}

        <div className="break-words whitespace-pre-wrap text-sm leading-tight">{renderBody()}</div>
        {isTail ? (
          <div
            className={cn(
              'mt-1 flex items-center gap-2 text-[11px] text-foreground-muted',
              outbound ? 'justify-end' : 'justify-start'
            )}
          >
            <span>{formatTime(message.createdAt)}</span>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--accent-inbox-primary)]',
                    ack.tone,
                    isFailedStatus && 'text-status-error focus-visible:ring-status-error/60'
                  )}
                  aria-label={ack.label}
                >
                  <AckIcon className={cn('h-3 w-3', isPendingStatus && 'animate-spin')} aria-hidden="true" />
                  <span className="sr-only">{ack.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{ack.label}</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MessageBubble;
