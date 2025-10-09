import { useEffect, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Brain, Paperclip, Smile, Send, FileText, Loader2, X } from 'lucide-react';
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
  windowInfo,
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
    if (windowInfo?.isOpen === false) {
      return 'Janela expirada — use um template para reabrir';
    }
    return 'Escreva uma resposta...';
  }, [disabled, windowInfo?.isOpen]);

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
    <div className="rounded-[26px] bg-slate-950/25 p-4 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.9)] ring-1 ring-white/5 backdrop-blur">
      {attachments.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <Badge
              key={file.id}
              variant="secondary"
              className="flex items-center gap-2 bg-slate-900/40 text-xs text-slate-200 ring-1 ring-white/5"
            >
              <span>{file.name}</span>
              <span className="text-slate-400">{Math.round(file.size / 1024)} KB</span>
              <button
                type="button"
                className="text-slate-400 transition hover:text-slate-100"
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
              className="h-10 w-10 rounded-full bg-slate-900/40 ring-1 ring-white/5"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-slate-900/40 text-slate-300 ring-1 ring-white/5 transition hover:bg-slate-900/30 hover:text-white"
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
              className="h-10 w-10 rounded-full bg-slate-900/40 text-slate-300 ring-1 ring-white/5 transition hover:bg-slate-900/30 hover:text-white"
              onClick={() => setTemplatePickerOpen((open) => !open)}
            >
              <Smile className="h-4 w-4" />
              <span className="sr-only">Abrir sugestões</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-slate-900/40 text-slate-300 ring-1 ring-white/5 transition hover:bg-slate-900/30 hover:text-white"
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
            disabled={(disabled && windowInfo?.isOpen !== false) || isSending}
            placeholder={placeholder}
            className="min-h-[88px] flex-1 resize-none rounded-[22px] border-none bg-slate-950/35 px-4 py-3 text-slate-100 placeholder:text-slate-500 ring-1 ring-white/5"
          />
          <Button
            variant="default"
            size="icon"
            className="h-12 w-12 rounded-full bg-sky-500 text-white shadow-[0_18px_36px_-24px_rgba(14,165,233,0.7)] transition hover:bg-sky-400"
            disabled={(disabled && windowInfo?.isOpen !== false) || isSending}
            onClick={handleSend}
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Enviar mensagem</span>
          </Button>
        </div>
      </div>

      {windowInfo?.isOpen === false ? (
        <div className="mt-2 flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
          <FileText className="h-4 w-4" />
          Janela de 24h expirada — envie um template aprovado para retomar a conversa.
        </div>
      ) : null}

      {sendError ? (
        <div className="mt-2 rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {sendError.message ?? 'Falha ao enviar mensagem.'}
        </div>
      ) : null}

      {aiSuggestions.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-2xl bg-slate-950/30 p-3 text-sm text-slate-200 ring-1 ring-white/5">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
            <span>Sugestões da IA</span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-slate-100" onClick={onDiscardSuggestion}>
              Limpar
            </Button>
          </div>
          <div className="space-y-2">
            {aiSuggestions.map((suggestion, index) => (
              <button
                key={`${index}-${suggestion.slice(0, 20)}`}
                type="button"
                className="w-full rounded-xl bg-slate-900/40 px-3 py-2 text-left text-xs text-slate-200 ring-1 ring-white/5 transition hover:bg-slate-900/30"
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
