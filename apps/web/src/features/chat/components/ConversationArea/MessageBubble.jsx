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
  Loader2,
} from 'lucide-react';

const STATUS_ICONS = {
  PENDING: { icon: Loader2, tone: 'text-foreground-muted', label: 'Enviando' },
  SENT: { icon: Check, tone: 'text-foreground-muted', label: 'Enviado' },
  DELIVERED: { icon: CheckCheck, tone: 'text-foreground', label: 'Entregue' },
  READ: { icon: BadgeCheck, tone: 'text-success', label: 'Lido' },
  FAILED: { icon: AlertTriangle, tone: 'text-status-error', label: 'Falha no envio' },
};

const POLL_PLACEHOLDER_MESSAGES = new Set(['[Mensagem recebida via WhatsApp]', '[Mensagem]']);

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
  const brokerMetadata = metadata?.broker && typeof metadata.broker === 'object' ? metadata.broker : {};
  const interactiveMetadata =
    metadata?.interactive && typeof metadata.interactive === 'object' ? metadata.interactive : null;
  const metadataPoll =
    metadata?.poll && typeof metadata.poll === 'object' && !Array.isArray(metadata.poll) ? metadata.poll : null;
  const interactivePoll =
    interactiveMetadata?.poll && typeof interactiveMetadata.poll === 'object' ? interactiveMetadata.poll : null;
  const pollChoiceMetadata =
    metadata?.pollChoice && typeof metadata.pollChoice === 'object' && !Array.isArray(metadata.pollChoice)
      ? metadata.pollChoice
      : null;
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
  const rawTextContent =
    typeof message.text === 'string' && message.text.trim().length > 0
      ? message.text
      : typeof message.content === 'string'
        ? message.content
        : '';

  const resolvedType = messageType === 'media' && mediaType ? mediaType : messageType;

  const pollAggregates =
    metadataPoll && metadataPoll.aggregates && typeof metadataPoll.aggregates === 'object'
      ? metadataPoll.aggregates
      : null;

  const pollOptionTotals =
    (metadataPoll && metadataPoll.optionTotals && typeof metadataPoll.optionTotals === 'object'
      ? metadataPoll.optionTotals
      : null) ?? (pollAggregates && typeof pollAggregates.optionTotals === 'object' ? pollAggregates.optionTotals : null);

  const pollTotalVotes =
    typeof metadataPoll?.totalVotes === 'number'
      ? metadataPoll.totalVotes
      : typeof pollAggregates?.totalVotes === 'number'
        ? pollAggregates.totalVotes
        : typeof interactivePoll?.totalVotes === 'number'
          ? interactivePoll.totalVotes
          : null;

  const pollTotalVoters =
    typeof metadataPoll?.totalVoters === 'number'
      ? metadataPoll.totalVoters
      : typeof pollAggregates?.totalVoters === 'number'
        ? pollAggregates.totalVoters
        : typeof interactivePoll?.totalVoters === 'number'
          ? interactivePoll.totalVoters
          : null;

  const pollId = (() => {
    const candidates = [metadataPoll?.pollId, metadataPoll?.id, pollChoiceMetadata?.pollId, pollChoiceMetadata?.id];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return null;
  })();

  const pollQuestion = (() => {
    const candidates = [
      metadataPoll?.question,
      metadataPoll?.title,
      metadataPoll?.name,
      interactivePoll?.question,
      interactivePoll?.title,
      interactivePoll?.name,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return null;
  })();

  const pollUpdatedAtIso = (() => {
    const candidates = [metadataPoll?.updatedAt, metadataPoll?.timestamp, pollChoiceMetadata?.vote?.timestamp];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return null;
  })();

  const pollOptionsLookup = (() => {
    const lookup = new Map();

    const register = (option, index) => {
      if (option === null || option === undefined) {
        return;
      }

      const buildEntry = (label, normalizedIndex) => ({
        label: label ?? `Opção ${normalizedIndex + 1}`,
        index: normalizedIndex,
      });

      if (typeof option === 'string') {
        const trimmed = option.trim();
        if (!trimmed) {
          return;
        }
        const entry = buildEntry(trimmed, index);
        if (!lookup.has(trimmed)) {
          lookup.set(trimmed, entry);
        }
        const indexKey = `__index:${index}`;
        if (!lookup.has(indexKey)) {
          lookup.set(indexKey, entry);
        }
        return;
      }

      if (typeof option !== 'object') {
        return;
      }

      const rawIndex =
        typeof option.index === 'number' && Number.isInteger(option.index) && option.index >= 0
          ? option.index
          : index;
      const normalizedIndex = rawIndex >= 0 ? rawIndex : index;
      const labelCandidate = [option.title, option.text, option.name, option.description].find(
        (value) => typeof value === 'string' && value.trim().length > 0
      );
      const label = labelCandidate ? labelCandidate.trim() : null;
      const entry = buildEntry(label, normalizedIndex);

      const idCandidate = [option.id, option.optionId, option.key, option.value].find(
        (value) => typeof value === 'string' && value.trim().length > 0
      );
      const normalizedId = idCandidate ? idCandidate.trim() : null;

      if (normalizedId && !lookup.has(normalizedId)) {
        lookup.set(normalizedId, entry);
      }

      const indexKey = `__index:${normalizedIndex}`;
      if (!lookup.has(indexKey)) {
        lookup.set(indexKey, entry);
      }
    };

    const registerFromArray = (value) => {
      if (!Array.isArray(value)) {
        return;
      }
      value.forEach((option, index) => register(option, index));
    };

    registerFromArray(metadataPoll?.options);
    registerFromArray(pollChoiceMetadata?.options);
    registerFromArray(interactivePoll?.options);

    return lookup;
  })();

  const pollSelectedOptions = (() => {
    const selections = [];
    const seen = new Set();

    const pushSelection = (id, title, indexHint) => {
      const normalizedId = typeof id === 'string' && id.trim().length > 0 ? id.trim() : null;
      const normalizedTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : null;
      const lookupById = normalizedId ? pollOptionsLookup.get(normalizedId) : null;
      const lookupByIndex =
        typeof indexHint === 'number' ? pollOptionsLookup.get(`__index:${indexHint}`) : null;
      const resolvedIndex =
        typeof indexHint === 'number'
          ? indexHint
          : lookupById?.index ?? lookupByIndex?.index ?? selections.length;
      const resolvedTitle =
        normalizedTitle ??
        lookupById?.label ??
        lookupByIndex?.label ??
        (normalizedId ? normalizedId : `Opção ${resolvedIndex + 1}`);
      const key = normalizedId ?? `__synthetic:${resolvedIndex}:${resolvedTitle}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      selections.push({
        id: normalizedId ?? key,
        title: resolvedTitle,
        index: resolvedIndex,
      });
    };

    const fromMetadata = Array.isArray(metadataPoll?.selectedOptions)
      ? metadataPoll.selectedOptions
      : [];
    fromMetadata.forEach((selection, index) => {
      if (selection === null || selection === undefined) {
        return;
      }
      if (typeof selection === 'string') {
        pushSelection(selection, selection, index);
        return;
      }
      if (typeof selection !== 'object') {
        return;
      }
      const idCandidate = [selection.id, selection.optionId].find(
        (value) => typeof value === 'string' && value.trim().length > 0
      );
      const indexCandidate = [selection.index, selection.position].find(
        (value) => typeof value === 'number' && Number.isInteger(value)
      );
      const titleCandidate = [selection.title, selection.text, selection.name].find(
        (value) => typeof value === 'string' && value.trim().length > 0
      );
      pushSelection(idCandidate ?? null, titleCandidate ?? null, indexCandidate ?? index);
    });

    const pollChoiceVote =
      pollChoiceMetadata && typeof pollChoiceMetadata.vote === 'object' ? pollChoiceMetadata.vote : null;

    const voteSelections = Array.isArray(pollChoiceVote?.selectedOptions)
      ? pollChoiceVote.selectedOptions
      : [];
    voteSelections.forEach((selection, index) => {
      if (selection === null || selection === undefined) {
        return;
      }
      if (typeof selection === 'string') {
        pushSelection(selection, selection, index);
        return;
      }
      if (typeof selection !== 'object') {
        return;
      }
      const idCandidate = [selection.id, selection.optionId].find(
        (value) => typeof value === 'string' && value.trim().length > 0
      );
      const indexCandidate = [selection.index, selection.position].find(
        (value) => typeof value === 'number' && Number.isInteger(value)
      );
      const titleCandidate = [selection.title, selection.text, selection.name].find(
        (value) => typeof value === 'string' && value.trim().length > 0
      );
      pushSelection(idCandidate ?? null, titleCandidate ?? null, indexCandidate ?? index);
    });

    if (selections.length === 0) {
      const optionIds = Array.isArray(pollChoiceVote?.optionIds) ? pollChoiceVote.optionIds : [];
      optionIds.forEach((optionId, index) => {
        if (typeof optionId !== 'string') {
          return;
        }
        const normalizedId = optionId.trim();
        if (!normalizedId) {
          return;
        }
        const lookupEntry = pollOptionsLookup.get(normalizedId) ?? pollOptionsLookup.get(`__index:${index}`);
        pushSelection(normalizedId, lookupEntry?.label ?? normalizedId, lookupEntry?.index ?? index);
      });
    }

    selections.sort((a, b) => a.index - b.index);
    return selections;
  })();

  const pollFallbackText =
    pollSelectedOptions.length > 0
      ? pollSelectedOptions
          .map((selection) =>
            typeof selection.title === 'string' && selection.title.trim().length > 0 ? selection.title.trim() : null
          )
          .filter(Boolean)
          .join(', ')
      : null;

  const normalizedRawText = rawTextContent.trim();
  const textContent =
    pollFallbackText && normalizedRawText && POLL_PLACEHOLDER_MESSAGES.has(normalizedRawText)
      ? pollFallbackText
      : rawTextContent;

  const pollSelectedIdSet = new Set(
    pollSelectedOptions
      .map((entry) => (typeof entry.id === 'string' ? entry.id : null))
      .filter((id) => id && !id.startsWith('__synthetic:'))
  );

  const pollSelectedTitleSet = new Set(
    pollSelectedOptions
      .map((entry) => (typeof entry.title === 'string' ? entry.title : null))
      .filter(Boolean)
  );

  const formatPollTimestamp = (value) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
    if (
      resolvedType === 'text' &&
      (metadata?.origin === 'poll_choice' || pollChoiceMetadata || pollSelectedOptions.length > 0)
    ) {
      const formattedTimestamp = formatPollTimestamp(pollUpdatedAtIso);
      const hasSelections = pollSelectedOptions.length > 0;

      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            Resposta de enquete
          </div>
          {pollQuestion ? <span className="text-xs text-foreground-muted">{pollQuestion}</span> : null}
          <div className="flex flex-col gap-1 rounded-lg bg-surface-overlay-quiet px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
              Opções escolhidas
            </span>
            {hasSelections ? (
              <ul className="ml-4 list-disc space-y-1 text-xs text-foreground">
                {pollSelectedOptions.map((selection, index) => (
                  <li key={`poll-selection-${selection.id ?? index}`}>{selection.title}</li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-foreground-muted">Nenhuma opção identificada</span>
            )}
          </div>
          {pollId ? (
            <span className="text-[10px] uppercase tracking-wide text-foreground-muted">
              ID da enquete: {pollId}
            </span>
          ) : null}
          {pollTotalVotes !== null || pollTotalVoters !== null ? (
            <div className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-foreground-muted">
              {pollTotalVotes !== null ? <span>Total de votos: {pollTotalVotes}</span> : null}
              {pollTotalVoters !== null ? <span>Total de participantes: {pollTotalVoters}</span> : null}
            </div>
          ) : null}
          {formattedTimestamp ? (
            <span className="text-[10px] uppercase tracking-wide text-foreground-muted">
              Atualizado em: {formattedTimestamp}
            </span>
          ) : null}
          {textContent ? (
            <p className="whitespace-pre-wrap break-words text-xs text-foreground-muted">{textContent}</p>
          ) : null}
        </div>
      );
    }

    if (resolvedType === 'text') {
      return <p className="whitespace-pre-wrap break-words text-sm leading-tight">{textContent}</p>;
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
      const pollOptionsSource =
        Array.isArray(metadataPoll?.options) && metadataPoll.options.length > 0
          ? metadataPoll.options
          : Array.isArray(interactivePoll?.options)
            ? interactivePoll.options
            : [];

      const poll = metadataPoll ?? interactivePoll;
      const pollTitleSource = pollQuestion ?? textContent;
      const pollTitle = pollTitleSource && pollTitleSource.trim().length > 0 ? pollTitleSource.trim() : 'Enquete';
      const pollOptions = pollOptionsSource;
      const isMetadataMissing = !poll && pollOptionsSource.length === 0;

      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            {pollTitle}
          </div>
          {pollOptions.length > 0 ? (
            <ul className="ml-5 list-disc space-y-1 text-xs text-foreground-muted">
              {pollOptions.map((option, index) => {
                const optionId =
                  typeof option?.id === 'string' && option.id.trim().length > 0
                    ? option.id.trim()
                    : typeof option?.optionId === 'string' && option.optionId.trim().length > 0
                      ? option.optionId.trim()
                      : null;
                const label = (() => {
                  const candidate = [option?.title, option?.name, option?.text, option?.description].find(
                    (value) => typeof value === 'string' && value.trim().length > 0
                  );
                  if (candidate) {
                    return candidate.trim();
                  }
                  const lookupEntry =
                    (optionId ? pollOptionsLookup.get(optionId) : null) ?? pollOptionsLookup.get(`__index:${index}`);
                  if (lookupEntry?.label) {
                    return lookupEntry.label;
                  }
                  return `Opção ${index + 1}`;
                })();
                const votes =
                  typeof option?.votes === 'number'
                    ? option.votes
                    : typeof option?.count === 'number'
                      ? option.count
                      : optionId && pollOptionTotals && typeof pollOptionTotals === 'object'
                        ? pollOptionTotals[optionId] ?? null
                        : null;
                const isSelected =
                  (optionId && pollSelectedIdSet.has(optionId)) || pollSelectedTitleSet.has(label);
                return (
                  <li key={`poll-option-${index}`} className="flex items-center gap-2">
                    <span className={cn('text-foreground-muted', isSelected && 'font-semibold text-foreground')}>
                      {label}
                    </span>
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
            <div className="flex flex-col gap-1 rounded-lg bg-surface-overlay-quiet px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
                Opções indisponíveis
              </span>
              <ul className="ml-4 list-disc space-y-1 text-xs text-foreground-muted">
                <li className="italic">
                  {isMetadataMissing
                    ? 'As opções desta enquete ainda não foram recebidas.'
                    : 'Nenhuma opção disponível.'}
                </li>
              </ul>
            </div>
          )}
          {pollTotalVotes !== null || pollTotalVoters !== null ? (
            <span className="text-[10px] uppercase tracking-wide text-foreground-muted">
              {pollTotalVotes !== null ? `Total de votos: ${pollTotalVotes}` : null}
              {pollTotalVotes !== null && pollTotalVoters !== null ? ' • ' : null}
              {pollTotalVoters !== null ? `Total de participantes: ${pollTotalVoters}` : null}
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
      </div>
    </div>
  );
};

export default MessageBubble;
