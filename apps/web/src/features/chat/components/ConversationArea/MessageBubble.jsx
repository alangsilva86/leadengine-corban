import { Suspense, lazy, useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.jsx';
import { cn } from '@/lib/utils.js';
import { AlertCircle, Check, CheckCheck, Clock3, Download, FileText, Loader2, MapPin } from 'lucide-react';

import { usePollMessage } from '../../hooks/usePollMessage.js';
import { formatMessageTime } from './utils/presentation.js';

const PollVoteBubble = lazy(() => import('./PollVoteBubble.jsx'));
const ContactBubble = lazy(() => import('./ContactBubble.jsx'));
const TemplateBubble = lazy(() => import('./TemplateBubble.jsx'));

// Confirmações de entrega (só em mensagens enviadas): Enviando · ✓ · ✓✓ · ✓✓ azul "Lida" · ⚠ falha.
const DELIVERY_STATUS = {
  PENDING: { icon: Clock3, className: 'text-subtle-foreground', label: 'Enviando' },
  QUEUED: { icon: Clock3, className: 'text-subtle-foreground', label: 'Enviando' },
  SENT: { icon: Check, className: 'text-subtle-foreground', label: 'Enviada' },
  DELIVERED: { icon: CheckCheck, className: 'text-subtle-foreground', label: 'Entregue' },
  READ: { icon: CheckCheck, className: 'text-primary', label: 'Lida' },
  PLAYED: { icon: CheckCheck, className: 'text-primary', label: 'Lida' },
  FAILED: { icon: AlertCircle, className: 'text-danger', label: 'Falha no envio' },
  ERROR: { icon: AlertCircle, className: 'text-danger', label: 'Falha no envio' },
};

const DeliveryStatus = ({ status }) => {
  const normalized = typeof status === 'string' ? status.toUpperCase() : 'SENT';
  const info = DELIVERY_STATUS[normalized] ?? DELIVERY_STATUS.SENT;
  const Icon = info.icon;
  return (
    <span className={cn('inline-flex items-center', info.className)} title={info.label}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{info.label}</span>
    </span>
  );
};

export const MessageBubble = ({
  message,
  isContinuation = false,
  isTail = true,
  isFirst = false,
  showMetadata = true,
  authorLabel = null,
}) => {
  const rawDirection = typeof message.direction === 'string' ? message.direction.toLowerCase() : 'inbound';
  const outbound = rawDirection === 'outbound';
  const normalizedStatus = typeof message.status === 'string' ? message.status.toUpperCase() : 'SENT';
  const isFailedStatus = normalizedStatus === 'FAILED' || normalizedStatus === 'ERROR';
  const bubbleClass = cn(
    'relative min-w-[4.5rem] max-w-[min(80%,36rem)] rounded-2xl px-3 pb-1.5 pt-2 text-sm text-foreground shadow-xs',
    outbound ? 'bg-bubble-out' : 'border border-border bg-bubble-in',
    isContinuation && (outbound ? 'rounded-tr-md' : 'rounded-tl-md'),
    !isTail && (outbound ? 'rounded-br-md' : 'rounded-bl-md'),
    isFailedStatus && 'ring-1 ring-danger',
  );
  const containerClass = cn(
    'flex w-full flex-col gap-1',
    outbound ? 'items-end' : 'items-start',
    isContinuation ? 'mt-0.5' : isFirst ? 'mt-0' : 'mt-3',
  );
  const metadata = (message.metadata && typeof message.metadata === 'object' ? message.metadata : {}) ?? {};
  const mediaPending =
    metadata.media_pending === true ||
    (typeof metadata.mediaStatus === 'string' && metadata.mediaStatus.toLowerCase() === 'pending');
  const time = formatMessageTime(message.createdAt);

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

  const [previewOpen, setPreviewOpen] = useState(false);
  const isPreviewable = useMemo(
    () => Boolean(mediaUrl && ['image', 'video', 'document'].includes(resolvedType)),
    [mediaUrl, resolvedType]
  );

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
        className="inline-flex w-fit items-center gap-2 rounded-full bg-surface-sunken px-3 py-1 text-xs font-medium text-foreground transition hover:bg-surface-hover"
      >
        <Download className="h-3 w-3" aria-hidden="true" />
        {label}
      </a>
    ) : null;

  const renderBody = () => {
    if (resolvedType === 'text' && voteBubble?.shouldRender) {
      return (
        <Suspense fallback={<span className="text-xs text-muted-foreground">Carregando enquete…</span>}>
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
        <Suspense fallback={<span className="text-xs text-muted-foreground">Carregando enquete…</span>}>
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
        <div className="flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Processando mídia…</span>
        </div>
      );
    }

    if (resolvedType === 'image' && mediaUrl) {
      return (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <div className="flex flex-col gap-2">
            <DialogTrigger asChild disabled={!isPreviewable}>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="group relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
              >
                <img
                  src={mediaUrl}
                  alt={caption ?? 'Imagem'}
                  className="max-h-64 w-full rounded-lg object-contain transition group-hover:brightness-110"
                />
                <span className="sr-only">Ampliar imagem</span>
              </button>
            </DialogTrigger>
            {caption ? <figcaption className="text-xs text-muted-foreground">{caption}</figcaption> : null}
            {renderDownloadAction('Baixar imagem')}
          </div>

          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Pré-visualização da imagem</DialogTitle>
              {caption ? <DialogDescription>{caption}</DialogDescription> : null}
            </DialogHeader>
            <div className="max-h-[70vh] overflow-hidden rounded-md bg-surface-sunken p-2">
              <img
                src={mediaUrl}
                alt={caption ?? 'Imagem'}
                className="mx-auto max-h-[65vh] w-full rounded-md object-contain"
              />
            </div>
            {renderDownloadAction('Baixar imagem')}
          </DialogContent>
        </Dialog>
      );
    }

    if (resolvedType === 'video') {
      if (!mediaUrl) {
        return renderUnsupported('vídeo');
      }

      return (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <div className="flex flex-col gap-2">
            <DialogTrigger asChild disabled={!isPreviewable}>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="group relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
              >
                <video
                  controls
                  src={mediaUrl}
                  className="max-h-64 w-full overflow-hidden rounded-lg transition group-hover:brightness-[1.08]"
                  preload="metadata"
                />
                <span className="sr-only">Ampliar vídeo</span>
              </button>
            </DialogTrigger>
            {caption ? <figcaption className="text-xs text-muted-foreground">{caption}</figcaption> : null}
            {renderDownloadAction('Baixar vídeo')}
          </div>

          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Pré-visualização do vídeo</DialogTitle>
              {caption ? <DialogDescription>{caption}</DialogDescription> : null}
            </DialogHeader>
            <div className="max-h-[70vh] overflow-hidden rounded-md bg-surface-sunken p-2">
              <video
                controls
                src={mediaUrl}
                className="mx-auto max-h-[65vh] w-full overflow-hidden rounded-md"
                preload="metadata"
              />
            </div>
            {renderDownloadAction('Baixar vídeo')}
          </DialogContent>
        </Dialog>
      );
    }

    if (resolvedType === 'audio') {
      if (!mediaUrl) {
        return renderUnsupported('áudio');
      }

      return (
        <div className="flex flex-col gap-2">
          <audio
            controls
            src={mediaUrl}
            className="w-full min-w-[240px] max-w-[560px]"
            preload="metadata"
          />
          {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
          {renderDownloadAction('Baixar áudio')}
        </div>
      );
    }

    if (resolvedType === 'document') {
      const fileName = resolveFileName();

      return (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <div className="flex flex-col gap-3">
            <DialogTrigger asChild disabled={!isPreviewable}>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-left transition hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
              >
                <FileText className="h-4 w-4 text-foreground" aria-hidden="true" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{fileName}</span>
                  <span className="text-xs text-muted-foreground">Documento</span>
                </div>
              </button>
            </DialogTrigger>
            {mediaUrl ? renderDownloadAction('Baixar arquivo') : (
              <span className="text-xs opacity-60">Pré-visualização indisponível</span>
            )}
            {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
          </div>

          {mediaUrl ? (
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{fileName}</DialogTitle>
                {caption ? <DialogDescription>{caption}</DialogDescription> : null}
              </DialogHeader>
              <div className="max-h-[70vh] overflow-hidden rounded-md bg-surface-sunken p-3">
                <div className="flex items-center gap-2 pb-3">
                  <FileText className="h-4 w-4 text-foreground" aria-hidden="true" />
                  <span className="text-sm font-semibold text-foreground">Pré-visualização do documento</span>
                </div>
                <iframe
                  title={`Pré-visualização de ${fileName}`}
                  src={mediaUrl}
                  className="h-[60vh] w-full rounded-md bg-background"
                />
              </div>
              {renderDownloadAction('Baixar arquivo')}
            </DialogContent>
          ) : null}
        </Dialog>
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
          <div className="flex items-start gap-2 rounded-lg bg-surface-sunken px-3 py-2">
            <MapPin className="mt-0.5 h-4 w-4 text-foreground" aria-hidden="true" />
            <div className="flex flex-col">
              {location.name ? <span className="font-semibold text-foreground">{location.name}</span> : null}
              {location.address ? (
                <span className="text-xs text-muted-foreground">{location.address}</span>
              ) : null}
              {typeof latitude === 'number' && typeof longitude === 'number' ? (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
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
              className="inline-flex w-fit items-center gap-2 rounded-full bg-surface-sunken px-3 py-1 text-xs font-medium text-foreground transition hover:bg-surface-hover"
            >
              <MapPin className="h-3 w-3" aria-hidden="true" />
              Abrir no mapa
            </a>
          ) : (
            <span className="text-xs opacity-60">Link de mapa indisponível</span>
          )}
          {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
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
        <Suspense fallback={<span className="text-xs text-muted-foreground">Carregando contatos…</span>}>
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
        <Suspense fallback={<span className="text-xs text-muted-foreground">Carregando template…</span>}>
          <TemplateBubble template={interactiveTemplate} caption={caption} />
        </Suspense>
      );
    }

    if (mediaUrl) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2">
            <Download className="h-4 w-4 text-foreground" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">Baixar conteúdo</span>
          </div>
          {renderDownloadAction('Abrir arquivo')}
          {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
        </div>
      );
    }

    return renderUnsupported(resolvedType);
  };

  const showAuthor = outbound && showMetadata && Boolean(authorLabel);

  return (
    <div
      className={containerClass}
      data-direction={outbound ? 'outbound' : 'inbound'}
      data-status={normalizedStatus.toLowerCase()}
    >
      {showAuthor ? (
        <span className="px-1 text-xs font-medium text-muted-foreground">{authorLabel}</span>
      ) : null}
      <div className={bubbleClass}>
        <div className="break-words whitespace-pre-wrap text-sm leading-snug">{renderBody()}</div>
        <div className="-mb-0.5 mt-0.5 flex items-center justify-end gap-1 text-[11px] leading-4 text-muted-foreground">
          {time ? <time dateTime={message.createdAt ?? undefined}>{time}</time> : null}
          {outbound ? <DeliveryStatus status={normalizedStatus} /> : null}
        </div>
      </div>
      {isFailedStatus ? (
        <span className="flex items-center gap-1 px-1 text-xs font-medium text-danger-soft-foreground" role="status">
          <AlertCircle className="size-3.5" aria-hidden />
          Falha no envio — não chegou ao cliente.
        </span>
      ) : null}
    </div>
  );
};

export default MessageBubble;
