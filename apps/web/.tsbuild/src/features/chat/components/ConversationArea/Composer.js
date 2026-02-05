import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Button } from '@/components/ui/button.jsx';
import { MessageSquarePlus, Paperclip, Smile, Send, Loader2, Wand2, X, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';
import QuickReplyMenu from '../Shared/QuickReplyMenu.jsx';
import InstanceBadge from '../Shared/InstanceBadge.jsx';
import TemplatePicker from './TemplatePicker.jsx';
import { useUploadWhatsAppMedia } from '../../api/useUploadWhatsAppMedia.js';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import AiModeMenu from './AiModeMenu.jsx';
import { DEFAULT_AI_MODE, getAiModeOption, isValidAiMode } from './aiModes.js';
const DEFAULT_REPLIES = [
    { id: 'hello', label: 'Saudação', text: 'Olá! Aqui é da Corban, tudo bem?' },
    { id: 'docs', label: 'Solicitar documentos', text: 'Pode me enviar os documentos para dar andamento?' },
    { id: 'followup', label: 'Agendar follow-up', text: 'Estou passando para lembrar do nosso combinado.' },
];
const COMMANDS = {
    '/tpl': 'template',
    '/nota': 'note',
    '/follow': 'follow-up',
};
const DEFAULT_EMOJIS = [
    '😀',
    '😁',
    '😂',
    '🤣',
    '😃',
    '😄',
    '😅',
    '😆',
    '😉',
    '😊',
    '😋',
    '😎',
    '😍',
    '😘',
    '🥰',
    '😗',
    '😙',
    '😚',
    '🙂',
    '🤗',
    '🤩',
    '🤔',
    '🤨',
    '😐',
    '😑',
    '😶',
    '🙄',
    '😏',
    '😣',
    '😥',
    '😮',
    '🤐',
    '😯',
    '😪',
    '😫',
    '🥱',
    '😴',
    '😌',
    '😛',
    '😜',
    '🤪',
    '😝',
    '🤤',
    '😒',
    '😓',
    '😔',
    '😕',
    '🙃',
    '🤑',
    '😭',
    '😤',
    '😡',
    '😱',
    '😳',
    '🤯',
    '🥳',
    '🥺',
    '🤠',
    '🤡',
    '🥶',
    '🥵',
    '🤧',
    '🤮',
    '🤒',
    '🤕',
    '🫠',
    '🫡',
    '🫢',
    '🫣',
    '🫠',
];
const detectCommand = (value) => {
    const trimmed = value.trimStart();
    for (const prefix of Object.keys(COMMANDS)) {
        if (trimmed.startsWith(prefix)) {
            return COMMANDS[prefix];
        }
    }
    return null;
};
export const Composer = forwardRef(function Composer({ disabled, onSend, onTemplate, onCreateNote, onTyping, isSending, sendError, aiConfidence, aiError, aiMode, aiModeChangeDisabled, onAiModeChange, aiStreaming = null, instanceSelector = null, }, ref) {
    const [value, setValue] = useState('');
    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [aiModeMenuOpen, setAiModeMenuOpen] = useState(false);
    const [instanceMenuOpen, setInstanceMenuOpen] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);
    const noteTextareaRef = useRef(null);
    const [quickReplies, setQuickReplies] = useState(() => [...DEFAULT_REPLIES]);
    const [uploadError, setUploadError] = useState(null);
    const { mutateAsync: uploadMedia, isPending: isUploading, } = useUploadWhatsAppMedia();
    const instanceSelectorData = instanceSelector ?? {};
    const availableInstanceOptions = Array.isArray(instanceSelectorData.options)
        ? instanceSelectorData.options
        : [];
    const selectedInstanceId = instanceSelectorData.selectedId ?? null;
    const selectedInstanceLabel = instanceSelectorData.selectedLabel ?? null;
    const selectedInstanceStatusLabel = instanceSelectorData.selectedStatusLabel ?? null;
    const selectedInstanceTone = instanceSelectorData.selectedTone ?? 'muted';
    const selectedInstanceConnected = instanceSelectorData.selectedConnected ?? true;
    const defaultInstanceId = instanceSelectorData.defaultId ?? null;
    const defaultInstanceLabel = instanceSelectorData.defaultLabel ?? null;
    const instanceSelectorLoading = Boolean(instanceSelectorData.loading);
    const instanceOverrideActive = Boolean(instanceSelectorData.isOverride);
    const requireConnected = Boolean(instanceSelectorData.requireConnected);
    const hasInstances = Boolean(instanceSelectorData.hasInstances);
    const instanceNotice = instanceSelectorData.notice ?? null;
    const showInstanceSelector = Boolean(instanceSelector);
    const instanceSelectorDisabled = Boolean(instanceSelectorData.disabled);
    const STATUS_DOT_CLASSES = {
        success: 'bg-success-strong',
        info: 'bg-[color:var(--accent-inbox-primary)]',
        warning: 'bg-warning-strong',
        danger: 'bg-status-error-foreground',
        muted: 'bg-surface-overlay-glass-border',
    };
    const STATUS_TEXT_CLASSES = {
        success: 'text-success-strong',
        info: 'text-[color:var(--accent-inbox-primary)]',
        warning: 'text-warning-strong',
        danger: 'text-status-error-foreground',
        muted: 'text-foreground-muted',
    };
    const NOTICE_CLASS_MAP = {
        info: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
        warning: 'border-warning-soft-border bg-warning-soft text-warning-strong',
        error: 'border-status-error-border bg-status-error-surface text-status-error-foreground',
    };
    const instanceBlockingSend = requireConnected && hasInstances && !selectedInstanceConnected;
    const instanceToneKey = STATUS_DOT_CLASSES[selectedInstanceTone] ? selectedInstanceTone : 'muted';
    const instanceStatusTextClass = STATUS_TEXT_CLASSES[instanceToneKey] ?? STATUS_TEXT_CLASSES.muted;
    const instanceDisplayLabel = selectedInstanceLabel ?? defaultInstanceLabel ?? 'Selecionar instância';
    const instanceDisplayStatus = selectedInstanceStatusLabel ??
        (selectedInstanceConnected ? 'Conectada' : 'Desconectada');
    const effectiveInstanceId = selectedInstanceId ?? defaultInstanceId ?? null;
    const aiStatus = aiStreaming?.status ?? 'idle';
    const isAiGenerating = aiStatus === 'streaming';
    const aiErrorMessage = aiStatus === 'error' ? aiStreaming?.error ?? null : null;
    const aiToolCalls = Array.isArray(aiStreaming?.toolCalls) ? aiStreaming.toolCalls : [];
    const [notePopoverOpen, setNotePopoverOpen] = useState(false);
    const [noteDraft, setNoteDraft] = useState('');
    const placeholder = useMemo(() => {
        if (disabled) {
            return 'Envio desabilitado no momento';
        }
        if (instanceBlockingSend) {
            return 'Selecione uma instância ativa para responder';
        }
        if (isAiGenerating) {
            return 'Copiloto IA gerando resposta...';
        }
        return 'Escreva uma resposta...';
    }, [disabled, instanceBlockingSend, isAiGenerating]);
    const normalizedAiMode = isValidAiMode(aiMode) ? aiMode : DEFAULT_AI_MODE;
    const aiModeOption = getAiModeOption(normalizedAiMode);
    const aiModeLabel = aiModeOption.shortLabel ?? aiModeOption.label;
    const aiModeButtonDisabled = disabled || aiModeChangeDisabled;
    useEffect(() => {
        const command = detectCommand(value);
        if (command === 'template') {
            setTemplatePickerOpen(true);
        }
        else {
            setTemplatePickerOpen(false);
        }
    }, [value]);
    useEffect(() => {
        if (attachments.length === 0 && uploadError) {
            setUploadError(null);
        }
    }, [attachments.length, uploadError]);
    useEffect(() => {
        if (disabled) {
            setEmojiPickerOpen(false);
            setNotePopoverOpen(false);
        }
    }, [disabled]);
    useEffect(() => {
        if (aiModeButtonDisabled) {
            setAiModeMenuOpen(false);
        }
    }, [aiModeButtonDisabled]);
    useEffect(() => {
        if (!showInstanceSelector || instanceSelectorDisabled) {
            setInstanceMenuOpen(false);
        }
    }, [instanceSelectorDisabled, showInstanceSelector]);
    useEffect(() => {
        if (notePopoverOpen) {
            noteTextareaRef.current?.focus?.();
        }
        else {
            setNoteDraft('');
        }
    }, [notePopoverOpen]);
    const resetComposer = () => {
        setValue('');
        setAttachments([]);
        setTemplatePickerOpen(false);
        setEmojiPickerOpen(false);
        setUploadError(null);
        aiStreaming?.reset?.();
    };
    const handleSend = async () => {
        const trimmed = value.trim();
        if ((!trimmed && attachments.length === 0) ||
            disabled ||
            isSending ||
            isUploading ||
            isAiGenerating) {
            return;
        }
        if (instanceBlockingSend) {
            if (showInstanceSelector) {
                setInstanceMenuOpen(true);
            }
            return;
        }
        const command = detectCommand(trimmed);
        if (command === 'template') {
            setValue('');
            setTemplatePickerOpen(true);
            return;
        }
        if (command === 'note') {
            onCreateNote?.(trimmed.replace('/nota', '').trim());
            setValue('');
            return;
        }
        if (command === 'follow-up') {
            onTemplate?.({ id: 'follow', content: 'Abrir modal follow-up' });
            return;
        }
        let normalizedAttachments = attachments;
        if (attachments.length > 0) {
            try {
                const uploaded = [];
                for (const item of attachments) {
                    const descriptor = await uploadMedia({
                        file: item.file,
                        fileName: item.name,
                        mimeType: item.type,
                    });
                    uploaded.push({
                        id: item.id,
                        name: item.name,
                        size: item.size,
                        type: item.type,
                        mediaUrl: descriptor.mediaUrl,
                        mimeType: descriptor.mimeType ?? item.type,
                        fileName: descriptor.fileName ?? item.name,
                        mediaSize: descriptor.size ?? item.size,
                    });
                }
                normalizedAttachments = uploaded;
                setUploadError(null);
            }
            catch (error) {
                console.error('Falha ao enviar anexo', error);
                const message = error instanceof Error ? error.message : 'Falha ao enviar anexo.';
                setUploadError({ message });
                return;
            }
        }
        const hasAttachments = normalizedAttachments.length > 0;
        const payloadContent = trimmed;
        const caption = hasAttachments ? trimmed || undefined : undefined;
        onSend?.({
            content: payloadContent,
            attachments: normalizedAttachments,
            caption,
        });
        resetComposer();
    };
    const handleAttachmentClick = () => {
        fileInputRef.current?.click();
    };
    const handleFilesSelected = (event) => {
        const files = Array.from(event.target.files ?? []);
        if (!files.length)
            return;
        const mapped = files.slice(0, 3).map((file) => ({
            id: `${file.name}-${file.size}-${Date.now()}`,
            name: file.name,
            size: file.size,
            type: file.type,
            file,
        }));
        setAttachments((current) => [...current, ...mapped]);
        event.target.value = '';
    };
    const removeAttachment = (id) => {
        setAttachments((current) => current.filter((item) => item.id !== id));
    };
    useImperativeHandle(ref, () => ({
        focusInput: () => {
            textareaRef.current?.focus();
        },
        openAttachmentDialog: () => {
            fileInputRef.current?.click();
        },
        setDraftValue: (nextValue, options = {}) => {
            if (typeof nextValue !== 'string') {
                return;
            }
            const { replace = false, append = false } = options;
            setValue((current) => {
                if (append) {
                    return `${current ?? ''}${nextValue}`;
                }
                if (replace) {
                    return nextValue;
                }
                return nextValue;
            });
        },
    }), []);
    const inputDisabled = disabled || isSending || isUploading || isAiGenerating;
    const aiCanGenerate = typeof aiStreaming?.onGenerate === 'function';
    const aiCanCancel = typeof aiStreaming?.onCancel === 'function';
    const aiButtonDisabled = (!isAiGenerating && !aiCanGenerate) ||
        (isAiGenerating && !aiCanCancel) ||
        isSending ||
        isUploading ||
        (disabled && !isAiGenerating);
    const handleGenerateAi = useCallback(() => {
        if (aiButtonDisabled || !aiCanGenerate) {
            return;
        }
        aiStreaming?.onGenerate?.();
    }, [aiButtonDisabled, aiCanGenerate, aiStreaming]);
    const handleCancelAi = useCallback(() => {
        if (!aiCanCancel) {
            return;
        }
        aiStreaming?.onCancel?.();
    }, [aiCanCancel, aiStreaming]);
    const handleSelectEmoji = useCallback((emoji) => {
        if (!emoji || inputDisabled) {
            return;
        }
        setValue((current) => `${current ?? ''}${emoji}`);
        setEmojiPickerOpen(false);
        textareaRef.current?.focus();
    }, [inputDisabled]);
    const handleSubmitNote = useCallback(() => {
        if (!onCreateNote) {
            return;
        }
        const trimmed = noteDraft.trim();
        if (!trimmed) {
            return;
        }
        onCreateNote(trimmed);
        setNotePopoverOpen(false);
    }, [noteDraft, onCreateNote]);
    const normalizedConfidence = typeof aiConfidence === 'number' && Number.isFinite(aiConfidence)
        ? Math.max(0, Math.min(100, Math.round(aiConfidence)))
        : null;
    const shouldShowAssumeBanner = normalizedConfidence !== null && normalizedConfidence < 60;
    return (_jsxs("div", { className: "rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/90 p-3 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.6)] backdrop-blur-sm", children: [attachments.length > 0 ? (_jsx("div", { className: "mb-2 flex flex-wrap gap-2", children: attachments.map((file) => (_jsxs(Badge, { variant: "secondary", className: "flex items-center gap-2 bg-surface-overlay-quiet text-xs text-foreground-muted ring-1 ring-surface-overlay-glass-border", children: [_jsx("span", { children: file.name }), _jsxs("span", { className: "text-foreground-muted", children: [Math.round(file.size / 1024), " KB"] }), _jsxs("button", { type: "button", className: "text-foreground-muted transition hover:text-foreground", onClick: () => removeAttachment(file.id), children: [_jsx(X, { className: "h-3 w-3" }), _jsx("span", { className: "sr-only", children: "Remover anexo" })] })] }, file.id))) })) : null, _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(QuickReplyMenu, { replies: quickReplies, onSelect: (text) => {
                                            if (inputDisabled) {
                                                return;
                                            }
                                            setValue((current) => `${current ? `${current}\n` : ''}${text}`);
                                        }, onCreate: (reply) => {
                                            setQuickReplies((current) => {
                                                const exists = current.some((item) => item.label === reply.label && item.text === reply.text);
                                                if (exists) {
                                                    return current;
                                                }
                                                return [...current, reply];
                                            });
                                        }, onTemplate: () => setTemplatePickerOpen(true), onGenerateAi: aiCanGenerate ? handleGenerateAi : undefined, onCancelAi: aiCanCancel ? handleCancelAi : undefined, isAiGenerating: isAiGenerating, className: "h-10 w-10 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground transition hover:bg-surface-overlay-strong" }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "h-10 w-10 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted transition hover:bg-surface-overlay-strong hover:text-foreground", onClick: handleAttachmentClick, disabled: inputDisabled, children: [_jsx(Paperclip, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Adicionar anexo" })] }) }), _jsx(TooltipContent, { children: "Adicionar anexo" })] }), _jsx("input", { ref: fileInputRef, type: "file", className: "hidden", multiple: true, onChange: handleFilesSelected }), _jsxs(Popover, { open: notePopoverOpen, onOpenChange: (open) => setNotePopoverOpen(inputDisabled ? false : open), children: [_jsxs(Tooltip, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsx(TooltipTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "h-10 w-10 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted transition hover:bg-surface-overlay-strong hover:text-foreground", disabled: inputDisabled, children: [_jsx(MessageSquarePlus, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Adicionar nota interna" })] }) }) }), _jsx(TooltipContent, { children: "Adicionar nota interna" })] }), _jsxs(PopoverContent, { className: "w-72 space-y-3 rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet p-3 shadow-lg", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-medium text-foreground", children: "Nova nota interna" }), _jsx(Textarea, { ref: noteTextareaRef, value: noteDraft, onChange: (event) => setNoteDraft(event.target.value), rows: 4, placeholder: "Escreva uma nota vis\u00EDvel apenas para a equipe" })] }), _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "ghost", className: "text-foreground-muted", onClick: () => setNotePopoverOpen(false), children: "Cancelar" }), _jsx(Button, { type: "button", size: "sm", disabled: !noteDraft.trim(), onClick: handleSubmitNote, children: "Registrar nota" })] })] })] }), _jsxs(Popover, { open: emojiPickerOpen, onOpenChange: setEmojiPickerOpen, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "h-10 w-10 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted transition hover:bg-surface-overlay-strong hover:text-foreground", disabled: inputDisabled, children: [_jsx(Smile, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Abrir emojis" })] }) }), _jsx(PopoverContent, { className: "w-64 max-h-60 overflow-y-auto rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet p-3", children: _jsx("div", { className: "grid grid-cols-8 gap-1", children: DEFAULT_EMOJIS.map((emoji) => (_jsx("button", { type: "button", className: "flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-surface-overlay-strong", onClick: () => handleSelectEmoji(emoji), children: _jsx("span", { role: "img", "aria-label": "emoji", children: emoji }) }, emoji))) }) })] })] }), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [showInstanceSelector ? (_jsxs(Popover, { open: instanceMenuOpen, onOpenChange: (open) => {
                                            if (instanceSelectorDisabled && !hasInstances && !instanceNotice) {
                                                return;
                                            }
                                            setInstanceMenuOpen(open);
                                        }, children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(PopoverTrigger, { asChild: true, children: _jsx(Button, { type: "button", variant: "ghost", size: "sm", className: cn('inline-flex items-center gap-2 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 text-xs font-semibold text-foreground transition hover:bg-surface-overlay-strong', instanceOverrideActive && 'border-[color:var(--accent-inbox-primary)]/60 text-[color:var(--accent-inbox-primary)]'), disabled: instanceSelectorDisabled && !hasInstances && !instanceSelectorLoading, children: instanceSelectorLoading ? (_jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin text-foreground-muted" })) : (_jsxs("span", { className: "flex items-center gap-2", children: [_jsx(InstanceBadge, { instanceId: effectiveInstanceId, withTooltip: false, className: "text-[10px]" }), _jsxs("span", { className: "flex max-w-[12rem] flex-col items-start", children: [_jsxs("span", { className: "truncate text-xs font-semibold", children: ["Enviando por ", instanceDisplayLabel] }), _jsx("span", { className: cn('text-[10px] uppercase tracking-[0.18em]', instanceStatusTextClass), children: instanceDisplayStatus })] })] })) }) }) }), _jsx(TooltipContent, { children: "Selecionar inst\u00E2ncia de envio" })] }), _jsxs(PopoverContent, { className: "w-72 rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet p-3 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.65)]", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 border-b border-surface-overlay-glass-border pb-2", children: [_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground-muted", children: "Inst\u00E2ncia de envio" }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 rounded-full border border-surface-overlay-glass-border text-foreground-muted hover:text-foreground", onClick: () => instanceSelectorData.onRefresh?.(), disabled: instanceSelectorLoading, children: [_jsx(RefreshCw, { className: cn('h-4 w-4', instanceSelectorLoading && 'animate-spin') }), _jsx("span", { className: "sr-only", children: "Atualizar inst\u00E2ncias" })] }) }), _jsx(TooltipContent, { children: "Atualizar inst\u00E2ncias" })] })] }), _jsx("div", { className: "mt-3 space-y-2 max-h-64 overflow-y-auto pr-1", children: availableInstanceOptions.length === 0 ? (_jsx("p", { className: "rounded-lg border border-dashed border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 py-4 text-center text-xs text-foreground-muted", children: "Nenhuma inst\u00E2ncia dispon\u00EDvel. Conecte ou atualize para visualizar op\u00E7\u00F5es." })) : (availableInstanceOptions.map((option) => {
                                                            const toneKey = STATUS_DOT_CLASSES[option.statusTone] ? option.statusTone : 'muted';
                                                            return (_jsxs("button", { type: "button", onClick: () => {
                                                                    instanceSelectorData.onSelect?.(option.id);
                                                                    setInstanceMenuOpen(false);
                                                                }, className: cn('w-full rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-[color:var(--accent-inbox-primary)]/40 hover:bg-surface-overlay-strong', selectedInstanceId === option.id &&
                                                                    'border-[color:var(--accent-inbox-primary)]/60 bg-[color:var(--accent-inbox-primary)]/10'), children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: cn('h-2 w-2 rounded-full', STATUS_DOT_CLASSES[toneKey] ?? STATUS_DOT_CLASSES.muted), "aria-hidden": true }), _jsx("span", { className: "flex-1 truncate text-sm font-semibold text-foreground", children: option.label }), option.id === defaultInstanceId ? (_jsx(Badge, { variant: "outline", className: "border-dashed text-[10px] uppercase tracking-[0.2em] text-foreground-muted", children: "Padr\u00E3o" })) : null] }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-2 text-[11px] text-foreground-muted", children: [_jsx("span", { className: "truncate", children: option.description }), _jsx("span", { className: cn('font-medium', STATUS_TEXT_CLASSES[toneKey] ?? STATUS_TEXT_CLASSES.muted), children: option.statusLabel })] })] }, option.id));
                                                        })) })] })] })) : null, _jsxs(Popover, { open: aiModeMenuOpen, onOpenChange: (open) => {
                                            if (aiModeButtonDisabled)
                                                return;
                                            setAiModeMenuOpen(open);
                                        }, children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(PopoverTrigger, { asChild: true, children: _jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: cn('inline-flex items-center gap-2 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 text-xs font-semibold text-foreground transition hover:bg-surface-overlay-strong', normalizedAiMode !== 'manual' && 'text-[color:var(--accent-inbox-primary)] border-[color:var(--accent-inbox-primary)]/60'), disabled: aiModeButtonDisabled, children: [_jsx(Wand2, { className: "h-3.5 w-3.5", "aria-hidden": true }), _jsx("span", { children: aiModeLabel })] }) }) }), _jsx(TooltipContent, { children: "Selecionar modo da IA" })] }), _jsx(PopoverContent, { className: "w-60 rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet p-2 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.65)]", children: _jsx(AiModeMenu, { mode: normalizedAiMode, onSelect: (mode) => {
                                                        if (mode !== normalizedAiMode) {
                                                            onAiModeChange?.(mode);
                                                        }
                                                    }, disabled: aiModeButtonDisabled, onRequestClose: () => setAiModeMenuOpen(false) }) })] })] })] }), showInstanceSelector && instanceNotice ? (_jsx("div", { className: cn('flex items-center gap-2 rounded-xl px-3 py-2 text-xs', NOTICE_CLASS_MAP[instanceNotice.type] ?? NOTICE_CLASS_MAP.info), role: "alert", children: _jsx("span", { children: instanceNotice.message }) })) : null, _jsxs("div", { className: "flex items-end gap-2", children: [_jsx(Textarea, { ref: textareaRef, value: value, onChange: (event) => {
                                    setValue(event.target.value);
                                    onTyping?.();
                                }, onKeyDown: (event) => {
                                    if ((event.key === 'Enter' && (event.metaKey || event.ctrlKey)) ||
                                        (event.key === 'Enter' && event.shiftKey === false && !templatePickerOpen)) {
                                        event.preventDefault();
                                        handleSend();
                                    }
                                    if (event.key === '/' && !value) {
                                        setTemplatePickerOpen(false);
                                    }
                                }, disabled: inputDisabled, readOnly: isAiGenerating, placeholder: placeholder, className: "min-h-[48px] max-h-36 flex-1 resize-none rounded-2xl border border-transparent bg-surface-overlay-quiet px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-0" }), _jsxs(Button, { variant: "default", size: "icon", className: "h-12 w-12 rounded-full bg-[color:var(--accent-inbox-primary)] text-white shadow-[0_16px_28px_-20px_rgba(14,165,233,0.7)] transition hover:bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_88%,transparent)]", disabled: inputDisabled || instanceBlockingSend, onClick: handleSend, children: [isSending || isUploading || isAiGenerating ? (_jsx(Loader2, { className: "h-4 w-4 animate-spin" })) : (_jsx(Send, { className: "h-4 w-4" })), _jsx("span", { className: "sr-only", children: "Enviar mensagem" })] })] })] }), isAiGenerating ? (_jsxs("div", { className: "mt-2 flex items-center gap-2 text-xs text-foreground-muted", children: [_jsx(Loader2, { className: "h-3 w-3 animate-spin" }), _jsx("span", { children: "Copiloto IA gerando resposta\u2026" }), aiCanCancel ? (_jsx("button", { type: "button", className: "font-medium text-[color:var(--accent-inbox-primary)] transition hover:text-[color:color-mix(in_srgb,var(--accent-inbox-primary)_84%,transparent)]", onClick: handleCancelAi, children: "Cancelar" })) : null] })) : null, aiErrorMessage ? (_jsx("div", { className: "mt-2 rounded-md bg-status-error-surface px-3 py-2 text-xs text-status-error-foreground", children: aiErrorMessage })) : null, aiToolCalls.length > 0 ? (_jsx("div", { className: "mt-2 space-y-1", children: aiToolCalls.map((tool) => (_jsxs("div", { className: "flex items-center justify-between rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet px-2 py-1 text-xs text-foreground", children: [_jsx("span", { className: "font-medium", children: tool.name ?? tool.id }), _jsx("span", { className: tool.status === 'success' ? 'text-success-strong' : 'text-status-error-foreground', children: tool.status === 'success' ? 'ok' : 'erro' })] }, tool.id))) })) : null, sendError ? (_jsx("div", { className: "mt-2 rounded-md bg-status-error-surface px-3 py-2 text-xs text-status-error-foreground", children: sendError.message ?? 'Falha ao enviar mensagem.' })) : null, uploadError ? (_jsx("div", { className: "mt-2 rounded-md bg-status-error-surface px-3 py-2 text-xs text-status-error-foreground", children: uploadError.message ?? 'Falha ao enviar anexo.' })) : null, aiError ? (_jsx("div", { className: "mt-2 rounded-md bg-status-error-surface px-3 py-2 text-xs text-status-error-foreground", children: aiError?.message ?? 'Não foi possível obter ajuda da IA.' })) : null, _jsx(TemplatePicker, { open: templatePickerOpen, onClose: () => setTemplatePickerOpen(false), onSelect: (template) => {
                    onTemplate?.(template);
                    resetComposer();
                } })] }));
});
Composer.displayName = 'Composer';
export default Composer;
