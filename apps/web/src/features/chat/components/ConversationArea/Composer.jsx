import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Brain, Paperclip, Smile, Send, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import QuickReplyMenu from '../Shared/QuickReplyMenu.jsx';
import TemplatePicker from './TemplatePicker.jsx';
import { useUploadWhatsAppMedia } from '../../api/useUploadWhatsAppMedia.js';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';

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
    onRequestSuggestion,
    aiLoading,
    aiSuggestions,
    onApplySuggestion,
    onDiscardSuggestion,
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

  const placeholder = useMemo(() => {
    if (disabled) {
      return 'Envio desabilitado no momento';
    }
    return 'Escreva uma resposta...';
  }, [disabled]);

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
  };

  const handleSend = async () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled || isSending || isUploading) {
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

  const handleSelectEmoji = useCallback(
    (emoji) => {
      if (!emoji || disabled) {
        return;
      }
      setValue((current) => `${current ?? ''}${emoji}`);
      setEmojiPickerOpen(false);
      textareaRef.current?.focus();
    },
    [disabled]
  );

  useImperativeHandle(
    ref,
    () => ({
      focusInput: () => {
        textareaRef.current?.focus();
      },
      openAttachmentDialog: () => {
        fileInputRef.current?.click();
      },
    }),
    []
  );

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
              className="h-9 w-9 rounded-xl bg-surface-overlay-quiet ring-1 ring-surface-overlay-glass-border"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl bg-surface-overlay-quiet text-foreground-muted ring-1 ring-surface-overlay-glass-border transition hover:bg-surface-overlay-strong hover:text-foreground"
              onClick={handleAttachmentClick}
            >
              <Paperclip className="h-4 w-4" />
              <span className="sr-only">Anexar arquivo</span>
            </Button>
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
                  className="h-9 w-9 rounded-xl bg-surface-overlay-quiet text-foreground-muted ring-1 ring-surface-overlay-glass-border transition hover:bg-surface-overlay-strong hover:text-foreground"
                  disabled={disabled || isSending || isUploading}
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
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl bg-surface-overlay-quiet text-foreground-muted ring-1 ring-surface-overlay-glass-border transition hover:bg-surface-overlay-strong hover:text-foreground"
              onClick={() => onRequestSuggestion?.()}
              disabled={aiLoading}
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              <span className="sr-only">Sugestões com IA</span>
            </Button>
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
            disabled={disabled || isSending || isUploading}
            placeholder={placeholder}
            className="min-h-[56px] max-h-40 flex-1 resize-none rounded-xl border border-transparent bg-surface-overlay-quiet px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-0"
          />
          <Button
            variant="default"
            size="icon"
            className="h-11 w-11 rounded-xl bg-[color:var(--accent-inbox-primary)] text-white shadow-[0_16px_28px_-20px_rgba(14,165,233,0.7)] transition hover:bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_88%,transparent)]"
            disabled={disabled || isSending || isUploading}
            onClick={handleSend}
          >
            {isSending || isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Enviar mensagem</span>
          </Button>
        </div>
      </div>

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

      {aiSuggestions.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-2xl bg-surface-overlay-quiet p-3 text-sm text-foreground ring-1 ring-surface-overlay-glass-border">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-foreground-muted">
            <span>Sugestões da IA</span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-foreground-muted hover:text-foreground" onClick={onDiscardSuggestion}>
              Limpar
            </Button>
          </div>
          <div className="space-y-2">
            {aiSuggestions.map((suggestion, index) => (
              <button
                key={`${index}-${suggestion.slice(0, 20)}`}
                type="button"
                className="w-full rounded-xl bg-surface-overlay-quiet px-3 py-2 text-left text-xs text-foreground-muted ring-1 ring-surface-overlay-glass-border transition hover:bg-surface-overlay-strong"
                onClick={() => onApplySuggestion?.(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
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
