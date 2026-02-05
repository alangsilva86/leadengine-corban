import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Suspense, lazy, useMemo, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, } from '@/components/ui/dialog.jsx';
import { cn } from '@/lib/utils.js';
import { Check, CheckCheck, BadgeCheck, AlertTriangle, Download, FileText, MapPin, Loader2, } from 'lucide-react';
import { usePollMessage } from '../../hooks/usePollMessage.js';
import InstanceBadge from '../Shared/InstanceBadge.jsx';
import useInstancePresentation from '../../hooks/useInstancePresentation.js';
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
    if (!value)
        return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
export const MessageBubble = ({ message, isContinuation = false, isTail = true, isFirst = false, showMetadata = true, }) => {
    const rawDirection = typeof message.direction === 'string' ? message.direction.toLowerCase() : 'inbound';
    const outbound = rawDirection === 'outbound';
    const tone = outbound
        ? 'bg-inbox-surface-strong text-inbox-foreground ring-1 ring-inbox-border'
        : 'bg-inbox-surface text-inbox-foreground ring-1 ring-inbox-border';
    const bubbleClass = cn('max-w-[72%] rounded-2xl px-3 py-2 text-sm leading-tight shadow-[0_10px_30px_-18px_rgba(15,23,42,0.6)] backdrop-blur transition-colors duration-150', tone, outbound ? 'self-end' : 'self-start', isContinuation && (outbound ? 'rounded-tr-md' : 'rounded-tl-md'), !isTail && (outbound ? 'rounded-br-md' : 'rounded-bl-md'));
    const containerClass = cn('flex w-full flex-col gap-0.5', outbound ? 'items-end' : 'items-start', isContinuation ? 'mt-1' : isFirst ? 'mt-0' : 'mt-3');
    const metadata = (message.metadata && typeof message.metadata === 'object' ? message.metadata : {}) ?? {};
    const mediaPending = metadata.media_pending === true ||
        (typeof metadata.mediaStatus === 'string' && metadata.mediaStatus.toLowerCase() === 'pending');
    const brokerMetadata = metadata?.broker && typeof metadata.broker === 'object' ? metadata.broker : {};
    const interactiveMetadata = metadata?.interactive && typeof metadata.interactive === 'object' ? metadata.interactive : null;
    const rawKeyMeta = metadata.rawKey && typeof metadata.rawKey === 'object' ? metadata.rawKey : {};
    const sourceInstance = metadata.sourceInstance ?? brokerMetadata.instanceId ?? message.instanceId ?? 'desconhecido';
    const remoteJid = metadata.remoteJid ?? metadata.chatId ?? rawKeyMeta.remoteJid ?? null;
    const phoneLabel = metadata.phoneE164 ?? remoteJid ?? message.chatId ?? 'desconhecido';
    const directionChipTone = outbound
        ? 'bg-accent text-accent-foreground'
        : 'bg-success-strong text-white';
    const directionLabel = outbound ? 'OUT' : 'IN';
    const timestamp = message.createdAt ? new Date(message.createdAt) : null;
    const tooltipTimestamp = timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toISOString() : null;
    const instancePresentation = useInstancePresentation(sourceInstance);
    const ack = STATUS_ICONS[message.status ?? 'SENT'] ?? STATUS_ICONS.SENT;
    const AckIcon = ack.icon;
    const normalizedStatus = typeof message.status === 'string' ? message.status.toUpperCase() : 'SENT';
    const isPendingStatus = normalizedStatus === 'PENDING';
    const isFailedStatus = normalizedStatus === 'FAILED';
    const messageType = typeof message.type === 'string' ? message.type.toLowerCase() : 'text';
    const media = message.media && typeof message.media === 'object' ? message.media : null;
    const mediaUrl = message.mediaUrl ?? media?.url ?? null;
    const mediaType = typeof message.mediaType === 'string'
        ? message.mediaType.toLowerCase()
        : typeof media?.mediaType === 'string'
            ? media.mediaType.toLowerCase()
            : null;
    const caption = typeof message.caption === 'string' && message.caption.trim().length > 0
        ? message.caption
        : typeof media?.caption === 'string'
            ? media.caption
            : null;
    const structuredTextContent = message &&
        message.content &&
        typeof message.content === 'object' &&
        typeof message.content.text === 'string' &&
        message.content.text.trim().length > 0
        ? message.content.text
        : null;
    const rawTextContentCandidate = typeof message.text === 'string' && message.text.trim().length > 0
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
    const isPreviewable = useMemo(() => Boolean(mediaUrl && ['image', 'video', 'document'].includes(resolvedType)), [mediaUrl, resolvedType]);
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
            }
            catch (error) {
                return mediaUrl.split('/').filter(Boolean).pop() ?? 'arquivo';
            }
        }
        return 'arquivo';
    };
    const renderUnsupported = (typeLabel) => (_jsxs("span", { className: "text-xs opacity-60", children: ["Mensagem n\u00E3o suportada (", typeLabel || 'desconhecida', ")"] }));
    const renderDownloadAction = (label = 'Baixar arquivo') => mediaUrl ? (_jsxs("a", { href: mediaUrl, target: "_blank", rel: "noreferrer noopener", className: "inline-flex w-fit items-center gap-2 rounded-full bg-surface-overlay-quiet px-3 py-1 text-xs font-medium text-foreground transition hover:bg-surface-overlay-strong", children: [_jsx(Download, { className: "h-3 w-3", "aria-hidden": "true" }), label] })) : null;
    const renderBody = () => {
        if (resolvedType === 'text' && voteBubble?.shouldRender) {
            return (_jsx(Suspense, { fallback: _jsx("span", { className: "text-xs text-foreground-muted", children: "Carregando enquete\u2026" }), children: _jsx(PollVoteBubble, { variant: "vote", question: voteBubble.question, pollId: voteBubble.pollId, totalVotes: voteBubble.totalVotes, totalVoters: voteBubble.totalVoters, updatedAtIso: voteBubble.updatedAtIso, selectedOptions: voteBubble.selectedOptions, textContent: voteBubble.textContent, caption: null }) }));
        }
        if (resolvedType === 'poll' && pollBubble?.shouldRender) {
            return (_jsx(Suspense, { fallback: _jsx("span", { className: "text-xs text-foreground-muted", children: "Carregando enquete\u2026" }), children: _jsx(PollVoteBubble, { variant: "poll", title: pollBubble.title, options: pollBubble.options, totalVotes: pollBubble.totalVotes, totalVoters: pollBubble.totalVoters, caption: caption, isMetadataMissing: pollBubble.isMetadataMissing }) }));
        }
        if (resolvedType === 'text') {
            return _jsx("p", { className: "whitespace-pre-wrap break-words text-sm leading-tight", children: textContent });
        }
        if (mediaPending) {
            return (_jsxs("div", { className: "flex items-center gap-2 rounded-lg bg-surface-overlay-quiet px-3 py-2", children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin text-foreground-muted", "aria-hidden": "true" }), _jsx("span", { className: "text-xs text-foreground-muted", children: "Processando m\u00EDdia\u2026" })] }));
        }
        if (resolvedType === 'image' && mediaUrl) {
            return (_jsxs(Dialog, { open: previewOpen, onOpenChange: setPreviewOpen, children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(DialogTrigger, { asChild: true, disabled: !isPreviewable, children: _jsxs("button", { type: "button", onClick: () => setPreviewOpen(true), className: "group relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--accent-inbox-primary)]", children: [_jsx("img", { src: mediaUrl, alt: caption ?? 'Imagem recebida', className: "max-h-64 w-full rounded-lg object-contain transition group-hover:brightness-110" }), _jsx("span", { className: "sr-only", children: "Ampliar imagem" })] }) }), caption ? _jsx("figcaption", { className: "text-xs text-foreground-muted", children: caption }) : null, renderDownloadAction('Baixar imagem')] }), _jsxs(DialogContent, { className: "sm:max-w-4xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Pr\u00E9-visualiza\u00E7\u00E3o da imagem" }), caption ? _jsx(DialogDescription, { children: caption }) : null] }), _jsx("div", { className: "max-h-[70vh] overflow-hidden rounded-md bg-black/50 p-2", children: _jsx("img", { src: mediaUrl, alt: caption ?? 'Imagem recebida', className: "mx-auto max-h-[65vh] w-full rounded-md object-contain" }) }), renderDownloadAction('Baixar imagem')] })] }));
        }
        if (resolvedType === 'video') {
            if (!mediaUrl) {
                return renderUnsupported('vídeo');
            }
            return (_jsxs(Dialog, { open: previewOpen, onOpenChange: setPreviewOpen, children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(DialogTrigger, { asChild: true, disabled: !isPreviewable, children: _jsxs("button", { type: "button", onClick: () => setPreviewOpen(true), className: "group relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--accent-inbox-primary)]", children: [_jsx("video", { controls: true, src: mediaUrl, className: "max-h-64 w-full overflow-hidden rounded-lg transition group-hover:brightness-[1.08]", preload: "metadata" }), _jsx("span", { className: "sr-only", children: "Ampliar v\u00EDdeo" })] }) }), caption ? _jsx("figcaption", { className: "text-xs text-foreground-muted", children: caption }) : null, renderDownloadAction('Baixar vídeo')] }), _jsxs(DialogContent, { className: "sm:max-w-4xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Pr\u00E9-visualiza\u00E7\u00E3o do v\u00EDdeo" }), caption ? _jsx(DialogDescription, { children: caption }) : null] }), _jsx("div", { className: "max-h-[70vh] overflow-hidden rounded-md bg-black/50 p-2", children: _jsx("video", { controls: true, src: mediaUrl, className: "mx-auto max-h-[65vh] w-full overflow-hidden rounded-md", preload: "metadata" }) }), renderDownloadAction('Baixar vídeo')] })] }));
        }
        if (resolvedType === 'audio') {
            if (!mediaUrl) {
                return renderUnsupported('áudio');
            }
            return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("audio", { controls: true, src: mediaUrl, className: "w-full min-w-[240px] max-w-[560px]", preload: "metadata" }), caption ? _jsx("p", { className: "text-xs text-foreground-muted", children: caption }) : null, renderDownloadAction('Baixar áudio')] }));
        }
        if (resolvedType === 'document') {
            const fileName = resolveFileName();
            return (_jsxs(Dialog, { open: previewOpen, onOpenChange: setPreviewOpen, children: [_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx(DialogTrigger, { asChild: true, disabled: !isPreviewable, children: _jsxs("button", { type: "button", onClick: () => setPreviewOpen(true), className: "flex items-center gap-2 rounded-lg bg-surface-overlay-quiet px-3 py-2 text-left transition hover:bg-surface-overlay-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--accent-inbox-primary)]", children: [_jsx(FileText, { className: "h-4 w-4 text-foreground", "aria-hidden": "true" }), _jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm font-semibold text-foreground", children: fileName }), _jsx("span", { className: "text-xs text-foreground-muted", children: "Documento" })] })] }) }), mediaUrl ? renderDownloadAction('Baixar arquivo') : (_jsx("span", { className: "text-xs opacity-60", children: "Pr\u00E9-visualiza\u00E7\u00E3o indispon\u00EDvel" })), caption ? _jsx("p", { className: "text-xs text-foreground-muted", children: caption }) : null] }), mediaUrl ? (_jsxs(DialogContent, { className: "sm:max-w-3xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: fileName }), caption ? _jsx(DialogDescription, { children: caption }) : null] }), _jsxs("div", { className: "max-h-[70vh] overflow-hidden rounded-md bg-surface-overlay-quiet p-3", children: [_jsxs("div", { className: "flex items-center gap-2 pb-3", children: [_jsx(FileText, { className: "h-4 w-4 text-foreground", "aria-hidden": "true" }), _jsx("span", { className: "text-sm font-semibold text-foreground", children: "Pr\u00E9-visualiza\u00E7\u00E3o do documento" })] }), _jsx("iframe", { title: `Pré-visualização de ${fileName}`, src: mediaUrl, className: "h-[60vh] w-full rounded-md bg-white" })] }), renderDownloadAction('Baixar arquivo')] })) : null] }));
        }
        if (resolvedType === 'location') {
            const location = metadata && typeof metadata.location === 'object' ? metadata.location : {};
            const latitude = typeof location.latitude === 'number' ? location.latitude : location.lat;
            const longitude = typeof location.longitude === 'number' ? location.longitude : location.lng;
            const mapsUrl = typeof location.url === 'string'
                ? location.url
                : typeof latitude === 'number' && typeof longitude === 'number'
                    ? `https://www.google.com/maps?q=${latitude},${longitude}`
                    : null;
            return (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-start gap-2 rounded-lg bg-surface-overlay-quiet px-3 py-2", children: [_jsx(MapPin, { className: "mt-0.5 h-4 w-4 text-foreground", "aria-hidden": "true" }), _jsxs("div", { className: "flex flex-col", children: [location.name ? _jsx("span", { className: "font-semibold text-foreground", children: location.name }) : null, location.address ? (_jsx("span", { className: "text-xs text-foreground-muted", children: location.address })) : null, typeof latitude === 'number' && typeof longitude === 'number' ? (_jsxs("span", { className: "text-[10px] uppercase tracking-wide text-foreground-muted", children: [latitude.toFixed(5), ", ", longitude.toFixed(5)] })) : null] })] }), mapsUrl ? (_jsxs("a", { href: mapsUrl, target: "_blank", rel: "noreferrer noopener", className: "inline-flex w-fit items-center gap-2 rounded-full bg-surface-overlay-quiet px-3 py-1 text-xs font-medium text-foreground transition hover:bg-surface-overlay-strong", children: [_jsx(MapPin, { className: "h-3 w-3", "aria-hidden": "true" }), "Abrir no mapa"] })) : (_jsx("span", { className: "text-xs opacity-60", children: "Link de mapa indispon\u00EDvel" })), caption ? _jsx("p", { className: "text-xs text-foreground-muted", children: caption }) : null] }));
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
            return (_jsx(Suspense, { fallback: _jsx("span", { className: "text-xs text-foreground-muted", children: "Carregando contatos\u2026" }), children: _jsx(ContactBubble, { contacts: contacts, caption: caption }) }));
        }
        if (resolvedType === 'template') {
            const interactiveTemplate = (metadata?.interactive && typeof metadata.interactive === 'object'
                ? metadata.interactive.template
                : null) ?? metadata?.template;
            return (_jsx(Suspense, { fallback: _jsx("span", { className: "text-xs text-foreground-muted", children: "Carregando template\u2026" }), children: _jsx(TemplateBubble, { template: interactiveTemplate, caption: caption }) }));
        }
        if (mediaUrl) {
            return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center gap-2 rounded-lg bg-surface-overlay-quiet px-3 py-2", children: [_jsx(Download, { className: "h-4 w-4 text-foreground", "aria-hidden": "true" }), _jsx("span", { className: "text-sm font-semibold text-foreground", children: "Baixar conte\u00FAdo" })] }), renderDownloadAction('Abrir arquivo'), caption ? _jsx("p", { className: "text-xs text-foreground-muted", children: caption }) : null] }));
        }
        return renderUnsupported(resolvedType);
    };
    return (_jsx("div", { className: containerClass, "data-direction": outbound ? 'outbound' : 'inbound', "data-status": (message.status ?? 'sent').toString().toLowerCase(), children: _jsxs("div", { className: bubbleClass, children: [showMetadata ? (_jsxs("div", { className: cn('mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide', outbound ? 'justify-end' : 'justify-start'), children: [_jsx("span", { className: cn('rounded-full px-2 py-0.5', directionChipTone), children: directionLabel }), _jsxs(Tooltip, { delayDuration: 200, children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { children: _jsx(InstanceBadge, { instanceId: sourceInstance, withTooltip: false, className: "text-[10px]" }) }) }), _jsxs(TooltipContent, { className: "space-y-1", children: [_jsxs("p", { className: "font-semibold", children: ["Inst\u00E2ncia: ", instancePresentation.label] }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Telefone: ", instancePresentation.number ?? 'Não informado'] }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Contato: ", phoneLabel] }), remoteJid ? _jsxs("p", { className: "text-xs text-muted-foreground", children: ["remoteJid: ", remoteJid] }) : null, tooltipTimestamp ? (_jsxs("p", { className: "text-xs text-muted-foreground", children: ["timestamp: ", tooltipTimestamp] })) : null] })] })] })) : null, _jsx("div", { className: "break-words whitespace-pre-wrap text-sm leading-tight", children: renderBody() }), isTail ? (_jsxs("div", { className: cn('mt-1 flex items-center gap-2 text-[11px] text-foreground-muted', outbound ? 'justify-end' : 'justify-start'), children: [_jsx("span", { children: formatTime(message.createdAt) }), _jsxs(Tooltip, { delayDuration: 200, children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs("button", { type: "button", className: cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--accent-inbox-primary)]', ack.tone, isFailedStatus && 'text-status-error focus-visible:ring-status-error/60'), "aria-label": ack.label, children: [_jsx(AckIcon, { className: cn('h-3 w-3', isPendingStatus && 'animate-spin'), "aria-hidden": "true" }), _jsx("span", { className: "sr-only", children: ack.label })] }) }), _jsx(TooltipContent, { children: ack.label })] })] })) : null] }) }));
};
export default MessageBubble;
