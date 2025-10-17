import { useEffect, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Brain, Paperclip, Smile, Send, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import QuickReplyMenu from '../Shared/QuickReplyMenu.jsx';
import TemplatePicker from './TemplatePicker.jsx';

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

const detectCommand = (value) => {
  const trimmed = value.trimStart();
  for (const prefix of Object.keys(COMMANDS)) {
    if (trimmed.startsWith(prefix)) {
      return COMMANDS[prefix];
    }
  }
  return null;
};

export const Composer = ({
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
}) => {
  const [value, setValue] = useState('');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);
  const [quickReplies, setQuickReplies] = useState(() => [...DEFAULT_REPLIES]);

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

  const resetComposer = () => {
    setValue('');
    setAttachments([]);
    setTemplatePickerOpen(false);
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled || isSending) {
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

    const payloadContent = trimmed || '[Anexo enviado]';

    onSend?.({
      content: payloadContent,
      attachments,
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

  return (
    <div className="rounded-[26px] bg-surface-overlay-quiet p-4 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.9)] ring-1 ring-surface-overlay-glass-border backdrop-blur">
      {attachments.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
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

      <div className="space-y-3">
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
              className="h-10 w-10 rounded-full bg-surface-overlay-quiet ring-1 ring-surface-overlay-glass-border"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-surface-overlay-quiet text-foreground-muted ring-1 ring-surface-overlay-glass-border transition hover:bg-surface-overlay-strong hover:text-foreground"
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
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-surface-overlay-quiet text-foreground-muted ring-1 ring-surface-overlay-glass-border transition hover:bg-surface-overlay-strong hover:text-foreground"
              onClick={() => setTemplatePickerOpen((open) => !open)}
            >
              <Smile className="h-4 w-4" />
              <span className="sr-only">Abrir sugestões</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-surface-overlay-quiet text-foreground-muted ring-1 ring-surface-overlay-glass-border transition hover:bg-surface-overlay-strong hover:text-foreground"
              onClick={() => onRequestSuggestion?.()}
              disabled={aiLoading}
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              <span className="sr-only">Sugestões com IA</span>
            </Button>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <Textarea
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
            disabled={disabled || isSending}
            placeholder={placeholder}
            className="min-h-[88px] flex-1 resize-none rounded-[22px] border-none bg-surface-overlay-quiet px-4 py-3 text-foreground placeholder:text-foreground-muted ring-1 ring-surface-overlay-glass-border"
          />
          <Button
            variant="default"
            size="icon"
            className="h-12 w-12 rounded-full bg-sky-500 text-white shadow-[0_18px_36px_-24px_rgba(14,165,233,0.7)] transition hover:bg-sky-400"
            disabled={disabled || isSending}
            onClick={handleSend}
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Enviar mensagem</span>
          </Button>
        </div>
      </div>

      {sendError ? (
        <div className="mt-2 rounded-md bg-status-error-surface px-3 py-2 text-xs text-status-error-foreground">
          {sendError.message ?? 'Falha ao enviar mensagem.'}
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
};

export default Composer;
