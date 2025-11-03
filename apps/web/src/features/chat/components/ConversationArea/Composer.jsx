import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Paperclip, Smile, Send, Loader2, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';
import QuickReplyMenu from '../Shared/QuickReplyMenu.jsx';
import TemplatePicker from './TemplatePicker.jsx';
import { useUploadWhatsAppMedia } from '../../api/useUploadWhatsAppMedia.js';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';

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

export const Composer = forwardRef(function Composer(
  {
    disabled,
    onSend,
    onTemplate,
    onCreateNote,
    onTyping,
    isSending,
    sendError,
    aiConfidence,
    aiError,
    aiStreaming = null,
  },
  ref
) {
  const [value, setValue] = useState('');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [quickReplies, setQuickReplies] = useState(() => [...DEFAULT_REPLIES]);
  const [uploadError, setUploadError] = useState(null);
  const {
    mutateAsync: uploadMedia,
    isPending: isUploading,
  } = useUploadWhatsAppMedia();

  const aiStatus = aiStreaming?.status ?? 'idle';
  const isAiGenerating = aiStatus === 'streaming';
  const aiErrorMessage = aiStatus === 'error' ? aiStreaming?.error ?? null : null;
  const aiToolCalls = Array.isArray(aiStreaming?.toolCalls) ? aiStreaming.toolCalls : [];

  const placeholder = useMemo(() => {
    if (disabled) {
      return 'Envio desabilitado no momento';
    }
    if (isAiGenerating) {
      return 'Copiloto IA gerando resposta...';
    }
    return 'Escreva uma resposta...';
  }, [disabled, isAiGenerating]);

  useEffect(() => {
    const command = detectCommand(value);
    if (command === 'template') {
      setTemplatePickerOpen(true);
    } else {
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
    }
  }, [disabled]);

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
    if (
      (!trimmed && attachments.length === 0) ||
      disabled ||
      isSending ||
      isUploading ||
      isAiGenerating
    ) {
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
      } catch (error) {
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
    if (!files.length) return;
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

  useImperativeHandle(
    ref,
    () => ({
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
    }),
    []
  );

  const inputDisabled = disabled || isSending || isUploading || isAiGenerating;
  const aiCanGenerate = typeof aiStreaming?.onGenerate === 'function';
  const aiCanCancel = typeof aiStreaming?.onCancel === 'function';
  const aiButtonDisabled =
    (!isAiGenerating && !aiCanGenerate) ||
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

  const handleSelectEmoji = useCallback(
    (emoji) => {
      if (!emoji || inputDisabled) {
        return;
      }
      setValue((current) => `${current ?? ''}${emoji}`);
      setEmojiPickerOpen(false);
      textareaRef.current?.focus();
    },
    [inputDisabled]
  );

  const normalizedConfidence =
    typeof aiConfidence === 'number' && Number.isFinite(aiConfidence)
      ? Math.max(0, Math.min(100, Math.round(aiConfidence)))
      : null;
  const shouldShowAssumeBanner = normalizedConfidence !== null && normalizedConfidence < 60;

  return (
    <div className="rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/90 p-3 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.6)] backdrop-blur-sm">
      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <Badge
              key={file.id}
              variant="secondary"
              className="flex items-center gap-2 bg-surface-overlay-quiet text-xs text-foreground-muted ring-1 ring-surface-overlay-glass-border"
            >
              <span>{file.name}</span>
              <span className="text-foreground-muted">{Math.round(file.size / 1024)} KB</span>
              <button
                type="button"
                className="text-foreground-muted transition hover:text-foreground"
                onClick={() => removeAttachment(file.id)}
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remover anexo</span>
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <QuickReplyMenu
              replies={quickReplies}
              onSelect={(text) => {
                if (inputDisabled) {
                  return;
                }
                setValue((current) => `${current ? `${current}\n` : ''}${text}`);
              }}
              onCreate={(reply) => {
                setQuickReplies((current) => {
                  const exists = current.some((item) => item.label === reply.label && item.text === reply.text);
                  if (exists) {
                    return current;
                  }
                  return [...current, reply];
                });
              }}
              onTemplate={() => setTemplatePickerOpen(true)}
              onGenerateAi={aiCanGenerate ? handleGenerateAi : undefined}
              onCancelAi={aiCanCancel ? handleCancelAi : undefined}
              isAiGenerating={isAiGenerating}
              className="h-10 w-10 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground transition hover:bg-surface-overlay-strong"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted transition hover:bg-surface-overlay-strong hover:text-foreground"
                  onClick={handleAttachmentClick}
                  disabled={inputDisabled}
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="sr-only">Adicionar anexo</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Adicionar anexo</TooltipContent>
            </Tooltip>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleFilesSelected}
            />
          <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted transition hover:bg-surface-overlay-strong hover:text-foreground"
                disabled={inputDisabled}
              >
                <Smile className="h-4 w-4" />
                <span className="sr-only">Abrir emojis</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 max-h-60 overflow-y-auto rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet p-3">
              <div className="grid grid-cols-8 gap-1">
                {DEFAULT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-surface-overlay-strong"
                    onClick={() => handleSelectEmoji(emoji)}
                  >
                    <span role="img" aria-label="emoji">
                      {emoji}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              onTyping?.();
            }}
            onKeyDown={(event) => {
              if (
                (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) ||
                (event.key === 'Enter' && event.shiftKey === false && !templatePickerOpen)
              ) {
                event.preventDefault();
                handleSend();
              }
              if (event.key === '/' && !value) {
                setTemplatePickerOpen(false);
              }
            }}
            disabled={inputDisabled}
            readOnly={isAiGenerating}
            placeholder={placeholder}
            className="min-h-[48px] max-h-36 flex-1 resize-none rounded-2xl border border-transparent bg-surface-overlay-quiet px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-0"
          />
          <Button
            variant="default"
            size="icon"
            className="h-12 w-12 rounded-full bg-[color:var(--accent-inbox-primary)] text-white shadow-[0_16px_28px_-20px_rgba(14,165,233,0.7)] transition hover:bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_88%,transparent)]"
            disabled={inputDisabled}
            onClick={handleSend}
          >
            {isSending || isUploading || isAiGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Enviar mensagem</span>
          </Button>
        </div>
      </div>

      {isAiGenerating ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-foreground-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Copiloto IA gerando resposta…</span>
          {aiCanCancel ? (
            <button
              type="button"
              className="font-medium text-[color:var(--accent-inbox-primary)] transition hover:text-[color:color-mix(in_srgb,var(--accent-inbox-primary)_84%,transparent)]"
              onClick={handleCancelAi}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      ) : null}

      {aiErrorMessage ? (
        <div className="mt-2 rounded-md bg-status-error-surface px-3 py-2 text-xs text-status-error-foreground">
          {aiErrorMessage}
        </div>
      ) : null}

      {aiToolCalls.length > 0 ? (
        <div className="mt-2 space-y-1">
          {aiToolCalls.map((tool) => (
            <div
              key={tool.id}
              className="flex items-center justify-between rounded-lg border border-surface-overlay-glass-border bg-surface-overlay-quiet px-2 py-1 text-xs text-foreground"
            >
              <span className="font-medium">{tool.name ?? tool.id}</span>
              <span
                className={tool.status === 'success' ? 'text-success-strong' : 'text-status-error-foreground'}
              >
                {tool.status === 'success' ? 'ok' : 'erro'}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {sendError ? (
        <div className="mt-2 rounded-md bg-status-error-surface px-3 py-2 text-xs text-status-error-foreground">
          {sendError.message ?? 'Falha ao enviar mensagem.'}
        </div>
      ) : null}

      {uploadError ? (
        <div className="mt-2 rounded-md bg-status-error-surface px-3 py-2 text-xs text-status-error-foreground">
          {uploadError.message ?? 'Falha ao enviar anexo.'}
        </div>
      ) : null}

      {aiError ? (
        <div className="mt-2 rounded-md bg-status-error-surface px-3 py-2 text-xs text-status-error-foreground">
          {aiError?.message ?? 'Não foi possível obter ajuda da IA.'}
        </div>
      ) : null}

      <TemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(template) => {
          onTemplate?.(template);
          resetComposer();
        }}
      />
    </div>
  );
});

Composer.displayName = 'Composer';

export default Composer;
