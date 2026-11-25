import { FileText, Paperclip, Smile, Sparkles, Square, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';

const EMOJIS = [
  '😀', '😁', '😂', '😊', '😉', '😍', '🥰', '😘', '🙂', '🤗', '🤩', '🤔', '😐', '🙄', '😅', '😎',
  '😢', '😭', '😤', '😱', '🥳', '🙏', '👍', '👎', '👏', '🙌', '👋', '🤝', '💪', '✅', '❌', '⚠️',
  '📄', '📎', '📞', '💰', '🏦', '📅', '⏰', '🎉', '❤️', '💙', '✨', '🔥',
];

const ToolbarButton = ({ label, shortcut, children, ...props }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground hover:text-foreground" {...props}>
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top">
      {label}
      {shortcut ? <span className="ml-1.5 opacity-80">{shortcut}</span> : null}
    </TooltipContent>
  </Tooltip>
);

/**
 * Ferramentas do composer, todas com nome acessível:
 * Anexar · Emoji · Respostas rápidas (/) · Modelos.
 */
const ComposerToolbar = ({
  mode = 'reply',
  disabled = false,
  onAttach,
  onEmoji,
  emojiOpen,
  onEmojiOpenChange,
  onQuickReplies,
  onTemplates,
}) => {
  const isNote = mode === 'note';
  return (
    <div className="flex items-center gap-0.5" role="toolbar" aria-label="Ferramentas da mensagem">
      {!isNote ? (
        <ToolbarButton label="Anexar arquivo" onClick={onAttach} disabled={disabled}>
          <Paperclip aria-hidden />
        </ToolbarButton>
      ) : null}
      <Popover open={emojiOpen} onOpenChange={onEmojiOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Inserir emoji"
                className="text-muted-foreground hover:text-foreground"
                disabled={disabled}
              >
                <Smile aria-hidden />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Inserir emoji</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" side="top" className="w-72 p-2">
          <div className="grid grid-cols-8 gap-0.5" role="group" aria-label="Emojis">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="flex size-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onEmoji?.(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {!isNote ? (
        <>
          <ToolbarButton label="Respostas rápidas" shortcut="/" onClick={onQuickReplies} disabled={disabled}>
            <Zap aria-hidden />
          </ToolbarButton>
          <ToolbarButton label="Modelos de mensagem" onClick={onTemplates} disabled={disabled}>
            <FileText aria-hidden />
          </ToolbarButton>
        </>
      ) : null}
    </div>
  );
};

/** "Sugerir resposta" (IA escreve no campo; o atendente revisa) ou "Parar". */
export const SuggestReplyButton = ({ generating = false, disabled = false, onGenerate, onCancel }) => {
  if (generating) {
    return (
      <Button type="button" variant="soft" size="sm" onClick={onCancel} aria-label="Parar sugestão da IA">
        <Square className="fill-current" aria-hidden />
        Parar
      </Button>
    );
  }
  return (
    <Button type="button" variant="soft" size="sm" onClick={onGenerate} disabled={disabled} aria-label="Sugerir resposta com IA">
      <Sparkles aria-hidden />
      <span className="hidden @md:inline">Sugerir resposta</span>
    </Button>
  );
};

export default ComposerToolbar;
