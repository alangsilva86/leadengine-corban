import { useEffect, useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Paperclip, Smile, Send, FileText } from 'lucide-react';
import QuickReplyList from '../Shared/QuickReplyList.jsx';
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
}) => {
  const [value, setValue] = useState('');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

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

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) {
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

    onSend?.(trimmed);
    setValue('');
  };

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/85 p-3">
      <QuickReplyList
        replies={DEFAULT_REPLIES}
        onSelect={(text) => {
          setValue((current) => `${current ? `${current}\n` : ''}${text}`);
        }}
        className="mb-2 flex flex-wrap gap-2"
      />

      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onTyping?.();
          }}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' && (event.metaKey || event.ctrlKey)) || (event.key === 'Enter' && event.shiftKey === false && !templatePickerOpen)) {
              event.preventDefault();
              handleSend();
            }
            if (event.key === '/' && !value) {
              setTemplatePickerOpen(false);
            }
          }}
          disabled={disabled && windowInfo?.isOpen !== false}
          placeholder={placeholder}
          className="min-h-[88px] flex-1 resize-none border-slate-800 bg-slate-900/70 text-slate-100 placeholder:text-slate-600"
        />
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-white">
            <Paperclip className="h-4 w-4" />
            <span className="sr-only">Anexar arquivo</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-white">
            <Smile className="h-4 w-4" />
            <span className="sr-only">Inserir emoji</span>
          </Button>
          <Button
            variant="default"
            size="icon"
            className="h-10 w-10 bg-sky-600 hover:bg-sky-500"
            disabled={disabled && windowInfo?.isOpen !== false}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Enviar mensagem</span>
          </Button>
        </div>
      </div>

      {windowInfo?.isOpen === false ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-amber-300">
          <FileText className="h-4 w-4" />
          Janela de 24h expirada — envie um template aprovado para retomar a conversa.
        </div>
      ) : null}

      <TemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(template) => {
          onTemplate?.(template);
          setTemplatePickerOpen(false);
          setValue('');
        }}
      />
    </div>
  );
};

export default Composer;
