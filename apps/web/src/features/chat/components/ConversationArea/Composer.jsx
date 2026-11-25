import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bot, FileText, Loader2, Lock, PlugZap, RotateCcw, Send, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useMediaQuery } from '@/hooks/use-media-query.js';
import { cn } from '@/lib/utils.js';
import { useUploadWhatsAppMedia } from '../../api/useUploadWhatsAppMedia.js';
import { DEFAULT_QUICK_REPLIES, NewQuickReplyDialog } from '../Shared/QuickReplyMenu.jsx';
import TemplatePicker from './TemplatePicker.jsx';
import ComposerToolbar, { SuggestReplyButton } from './composer/ComposerToolbar.jsx';
import AttachmentTray from './composer/AttachmentTray.jsx';
import InstanceSelector from './composer/InstanceSelector.jsx';
import SlashPalette from './composer/SlashPalette.jsx';
import TeammatesPresence from './composer/TeammatesPresence.jsx';
import useComposerState, { ACCEPTED_FILE_TYPES } from './composer/useComposerState.js';
import { fillTemplatePlaceholders, getFirstName } from './utils/presentation.js';

const MODES = [
  { value: 'reply', label: 'Responder' },
  { value: 'note', label: 'Nota interna' },
];

const SLASH_PATTERN = /^\/(\S*)$/;

const normalizeSearch = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Por que não dá para responder agora — sempre com uma saída. */
const BlockedReply = ({ reason }) => {
  if (!reason) return null;
  const Icon = reason.icon ?? AlertCircle;
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-3" role="status">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{reason.title}</p>
        {reason.description ? <p className="text-xs text-muted-foreground">{reason.description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {reason.secondaryAction ? reason.secondaryAction : null}
        {reason.action ? reason.action : null}
      </div>
    </div>
  );
};

/**
 * Composer da conversa.
 * - Modos "Responder" | "Nota interna" (nota tinge o composer e vira "Salvar nota").
 * - Rascunho por conversa (sessionStorage) — trocar de conversa nunca leva o texto junto.
 * - "/" abre respostas rápidas; modelos são INSERIDOS para revisão, nunca enviados sozinhos.
 * - Enter envia no computador (Shift+Enter quebra linha); no celular Enter quebra linha.
 */
export const Composer = forwardRef(function Composer(
  {
    ticketId = null,
    contactName = null,
    disabled = false,
    disabledReason = null,
    onSend,
    onCreateNote,
    onTyping,
    teammatesTyping = [],
    teammatesViewing = [],
    isSending = false,
    sendError = null,
    aiError = null,
    aiStreaming = null,
    instanceSelector = null,
    windowState = null,
    closed = false,
    onReopen,
    aiAutonomous = false,
    onTakeOver,
    notice = null,
  },
  ref,
) {
  const composerId = useId();
  const hintId = `${composerId}-hint`;
  const paletteId = `${composerId}-palette`;
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const isCoarsePointer = useMediaQuery('(pointer: coarse)');

  const {
    mode,
    setMode,
    value,
    trimmed,
    setValue,
    clearValue,
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    attachmentError,
    setAttachmentError,
  } = useComposerState({ ticketId });

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [instanceMenuOpen, setInstanceMenuOpen] = useState(false);
  const [newReplyOpen, setNewReplyOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState(() => [...DEFAULT_QUICK_REPLIES]);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [paletteDismissed, setPaletteDismissed] = useState(false);
  const [paletteForced, setPaletteForced] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const { mutateAsync: uploadMedia, isPending: isUploading } = useUploadWhatsAppMedia();

  const isNote = mode === 'note';
  const firstName = getFirstName(contactName);
  const aiStatus = aiStreaming?.status ?? 'idle';
  const isAiGenerating = aiStatus === 'streaming';
  const aiStreamError = aiStatus === 'error' ? aiStreaming?.error ?? null : null;

  const selector = instanceSelector ?? null;
  const instanceBlockingSend = Boolean(
    selector?.requireConnected && selector?.hasInstances && selector?.selectedConnected === false,
  );

  // Motivo para não responder (notas internas continuam liberadas).
  const blockedReason = useMemo(() => {
    if (closed) {
      return {
        icon: Lock,
        title: 'Conversa encerrada',
        description: 'Reabra para responder o cliente. Notas internas continuam liberadas.',
        action: onReopen ? (
          <Button type="button" size="sm" onClick={onReopen}>
            <RotateCcw aria-hidden />
            Reabrir
          </Button>
        ) : null,
      };
    }
    if (aiAutonomous) {
      return {
        icon: Bot,
        title: 'IA respondendo esta conversa',
        description: 'Assuma para escrever você mesmo.',
        action: onTakeOver ? (
          <Button type="button" size="sm" onClick={onTakeOver}>
            Assumir
          </Button>
        ) : null,
      };
    }
    if (disabled) {
      return {
        icon: PlugZap,
        title: disabledReason?.title ?? 'Envio indisponível',
        description: disabledReason?.description ?? 'Conecte um número de WhatsApp para voltar a enviar.',
        action: (
          <Button asChild type="button" size="sm" variant="outline">
            <a href="/channels">Conectar número</a>
          </Button>
        ),
      };
    }
    if (instanceBlockingSend) {
      const otherConnected = (selector?.options ?? []).some((option) => option.connected && option.id !== selector?.selectedId);
      return {
        icon: Unplug,
        title: 'Número desconectado',
        description: `${selector?.selectedLabel ?? 'O número escolhido'} está fora do ar. Reconecte ou envie por outro número.`,
        secondaryAction: otherConnected ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setInstanceMenuOpen(true)}>
            Trocar número
          </Button>
        ) : null,
        action: (
          <Button asChild type="button" size="sm" variant="outline">
            <a href="/channels">Reconectar</a>
          </Button>
        ),
      };
    }
    return null;
  }, [aiAutonomous, closed, disabled, disabledReason, instanceBlockingSend, onReopen, onTakeOver, selector]);

  const replyBlocked = !isNote && Boolean(blockedReason);

  // Paleta "/" (respostas rápidas e atalhos).
  const slashMatch = !isNote && !paletteDismissed ? SLASH_PATTERN.exec(value) : null;
  const paletteQuery = slashMatch ? slashMatch[1] ?? '' : paletteForced && !isNote ? '' : null;
  const paletteItems = useMemo(() => {
    if (paletteQuery === null) return [];
    const query = normalizeSearch(paletteQuery);
    const replies = quickReplies
      .filter((reply) => !query || normalizeSearch(`${reply.label} ${reply.text}`).includes(query))
      .map((reply) => ({
        id: `reply-${reply.id}`,
        type: 'reply',
        label: reply.label,
        preview: fillTemplatePlaceholders(reply.text, { contactName }),
        text: reply.text,
      }));
    const commands = [
      { id: 'cmd-templates', type: 'templates', label: 'Modelos de mensagem', keywords: 'modelo template tpl' },
      { id: 'cmd-note', type: 'note', label: 'Escrever nota interna', keywords: 'nota note interna' },
      { id: 'cmd-create', type: 'create', label: 'Nova resposta rápida', keywords: 'nova criar resposta' },
    ].filter((command) => !query || normalizeSearch(`${command.label} ${command.keywords}`).includes(query));
    return [...replies, ...commands];
  }, [contactName, paletteQuery, quickReplies]);
  const paletteOpen = paletteQuery !== null && !replyBlocked;

  useEffect(() => {
    setPaletteIndex(0);
  }, [paletteQuery, paletteOpen]);

  useEffect(() => {
    if (!value.startsWith('/')) {
      setPaletteDismissed(false);
    }
  }, [value]);

  const insertText = useCallback(
    (text, { replace = false } = {}) => {
      if (typeof text !== 'string') return;
      setValue((current) => {
        if (replace || !current.trim() || SLASH_PATTERN.test(current)) return text;
        return `${current.replace(/\s+$/, '')}\n${text}`;
      });
      requestAnimationFrame?.(() => textareaRef.current?.focus());
    },
    [setValue],
  );

  const handlePaletteSelect = useCallback(
    (item) => {
      if (!item) return;
      const fromSlash = SLASH_PATTERN.test(value);
      setPaletteForced(false);
      if (item.type === 'reply') {
        insertText(fillTemplatePlaceholders(item.text, { contactName }), { replace: fromSlash });
        return;
      }
      if (fromSlash) setValue('');
      if (item.type === 'templates') {
        setTemplatePickerOpen(true);
      } else if (item.type === 'note') {
        setMode('note');
        requestAnimationFrame?.(() => textareaRef.current?.focus());
      } else if (item.type === 'create') {
        setNewReplyOpen(true);
      }
    },
    [contactName, insertText, setMode, setValue, value],
  );

  const busy = isSending || isUploading;
  const hasContent = trimmed.length > 0 || (!isNote && attachments.length > 0);
  const canSubmit = hasContent && !busy && !isAiGenerating && !replyBlocked && !paletteOpen;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (isNote) {
      onCreateNote?.(trimmed);
      clearValue();
      onTyping?.({ hasText: false });
      setMode('reply');
      return;
    }

    let normalizedAttachments = attachments;
    if (attachments.length > 0) {
      try {
        const uploaded = [];
        for (const item of attachments) {
          const descriptor = await uploadMedia({ file: item.file, fileName: item.name, mimeType: item.type });
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
        setUploadError(error instanceof Error && error.message ? error.message : 'Não foi possível enviar o anexo.');
        return;
      }
    }

    const hasAttachments = normalizedAttachments.length > 0;
    const accepted = await onSend?.({
      content: trimmed,
      attachments: normalizedAttachments,
      caption: hasAttachments ? trimmed || undefined : undefined,
    });
    if (accepted !== false && onSend) {
      clearValue();
      clearAttachments();
      onTyping?.({ hasText: false });
      setUploadError(null);
      aiStreaming?.reset?.();
    }
  };

  const handleKeyDown = (event) => {
    if (paletteOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setPaletteIndex((index) => Math.min(paletteItems.length - 1, index + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setPaletteIndex((index) => Math.max(0, index - 1));
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && paletteItems.length > 0) {
        event.preventDefault();
        handlePaletteSelect(paletteItems[paletteIndex] ?? paletteItems[0]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setPaletteDismissed(true);
        setPaletteForced(false);
        return;
      }
    }

    if (event.key !== 'Enter' || event.nativeEvent?.isComposing) return;
    const forceSend = event.metaKey || event.ctrlKey;
    if (forceSend || (!event.shiftKey && !isCoarsePointer)) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      focusInput: () => textareaRef.current?.focus(),
      openAttachmentDialog: () => {
        setMode('reply');
        fileInputRef.current?.click();
      },
      openTemplatePicker: () => {
        setMode('reply');
        setTemplatePickerOpen(true);
      },
      insertText: (text) => insertText(text),
      setDraftValue: (nextValue, options = {}) => {
        if (typeof nextValue !== 'string') return;
        const { append = false } = options;
        setValue((current) => (append ? `${current ?? ''}${nextValue}` : nextValue));
      },
    }),
    [insertText, setMode, setValue],
  );

  const placeholder = isNote
    ? 'Escreva uma nota para a equipe — o cliente não vê.'
    : isAiGenerating
      ? 'A IA está escrevendo uma sugestão…'
      : isCoarsePointer
        ? firstName
          ? `Mensagem para ${firstName}`
          : 'Escreva uma mensagem'
        : firstName
          ? `Mensagem para ${firstName} — “/” para respostas rápidas`
          : 'Escreva uma mensagem — “/” para respostas rápidas';

  const aiCanGenerate = typeof aiStreaming?.onGenerate === 'function';
  const windowClosed = !isNote && windowState?.state === 'closed' && !replyBlocked;
  const statusError = uploadError ?? attachmentError ?? null;
  const aiMessage = aiStreamError ?? (aiError ? aiError.message ?? 'Não foi possível obter ajuda da IA.' : null);
  const showSendError = Boolean(sendError) && !notice;

  return (
    <div className="@container flex flex-col gap-2">
      <TeammatesPresence typing={teammatesTyping} viewers={teammatesViewing} />
      {notice ? (
        <div className="flex items-start gap-3 rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger-soft-foreground" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{notice.title ?? 'Mensagem não enviada'}</p>
            {notice.description ? <p className="mt-0.5 text-xs">{notice.description}</p> : null}
          </div>
          {notice.actionLabel && typeof notice.onAction === 'function' ? (
            <Button type="button" size="xs" variant="outline" onClick={() => notice.onAction()}>
              {notice.actionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          'overflow-hidden rounded-lg border transition-colors focus-within:border-border-strong',
          isNote ? 'border-border bg-bubble-note' : 'border-border bg-surface',
        )}
      >
        <div className="flex items-center gap-1 border-b border-border px-2 pt-1.5" role="tablist" aria-label="Tipo de mensagem">
          {MODES.map((item) => {
            const selected = mode === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setMode(item.value);
                  requestAnimationFrame?.(() => textareaRef.current?.focus());
                }}
                className={cn(
                  '-mb-px inline-flex h-8 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {item.value === 'note' ? <Lock className="size-3.5" aria-hidden /> : null}
                {item.label}
              </button>
            );
          })}
        </div>

        {windowClosed ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground" role="status">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1">A janela de 24 h encerrou. Envie um modelo aprovado para retomar.</p>
            <Button type="button" size="xs" variant="outline" onClick={() => setTemplatePickerOpen(true)}>
              <FileText aria-hidden />
              Escolher modelo
            </Button>
          </div>
        ) : null}

        {replyBlocked ? (
          <BlockedReply reason={blockedReason} />
        ) : (
          <>
            {paletteOpen ? (
              <SlashPalette
                id={paletteId}
                items={paletteItems}
                activeIndex={paletteIndex}
                onSelect={handlePaletteSelect}
                onHover={setPaletteIndex}
              />
            ) : null}
            {!isNote ? <AttachmentTray attachments={attachments} onRemove={removeAttachment} disabled={busy} /> : null}
            <textarea
              ref={textareaRef}
              rows={1}
              value={value}
              onChange={(event) => {
                const nextValue = event.target.value;
                setValue(nextValue);
                // Outros atendentes veem "Fulano está digitando…" (resposta) ou "…escrevendo uma nota" (nota).
                onTyping?.({ mode: isNote ? 'note' : 'reply', hasText: nextValue.trim().length > 0 });
              }}
              onKeyDown={handleKeyDown}
              readOnly={isAiGenerating}
              disabled={busy && !isNote}
              placeholder={placeholder}
              aria-label={isNote ? 'Nota interna para a equipe' : `Mensagem para ${contactName ?? 'o cliente'}`}
              aria-describedby={hintId}
              aria-autocomplete={paletteOpen ? 'list' : undefined}
              aria-controls={paletteOpen ? paletteId : undefined}
              aria-activedescendant={paletteOpen && paletteItems.length > 0 ? `${paletteId}-option-${paletteIndex}` : undefined}
              className="block max-h-[9.5rem] min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-5 text-foreground outline-none [field-sizing:content] placeholder:text-subtle-foreground disabled:opacity-60"
            />
            <div className="flex items-center gap-2 px-1.5 pb-1.5">
              <ComposerToolbar
                mode={mode}
                disabled={busy || isAiGenerating}
                onAttach={() => fileInputRef.current?.click()}
                onEmoji={(emoji) => {
                  setValue((current) => `${current ?? ''}${emoji}`);
                  setEmojiOpen(false);
                  textareaRef.current?.focus();
                }}
                emojiOpen={emojiOpen}
                onEmojiOpenChange={setEmojiOpen}
                onQuickReplies={() => {
                  setPaletteDismissed(false);
                  if (!value.trim()) {
                    setValue('/');
                  } else {
                    setPaletteForced((current) => !current);
                  }
                  textareaRef.current?.focus();
                }}
                onTemplates={() => setTemplatePickerOpen(true)}
              />
              <div className="ml-auto flex items-center gap-1.5">
                {!isNote && aiCanGenerate ? (
                  <SuggestReplyButton
                    generating={isAiGenerating}
                    disabled={busy}
                    onGenerate={() => aiStreaming?.onGenerate?.()}
                    onCancel={() => aiStreaming?.onCancel?.()}
                  />
                ) : null}
                <Button type="button" size="sm" onClick={() => void handleSubmit()} disabled={!canSubmit}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden /> : isNote ? <Lock aria-hidden /> : <Send aria-hidden />}
                  {isNote ? 'Salvar nota' : 'Enviar'}
                </Button>
              </div>
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground">
        {!isNote ? (
          <InstanceSelector selector={selector} open={instanceMenuOpen} onOpenChange={setInstanceMenuOpen} />
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3" aria-hidden />
            Só a equipe vê esta nota.
          </span>
        )}
        {!isNote && windowState?.label && (windowState.state === 'open' || windowState.state === 'closing') ? (
          <span className={cn('truncate', windowState.state === 'closing' && 'font-medium text-warning-soft-foreground')}>
            {windowState.label}
          </span>
        ) : null}
        <span id={hintId} className="ml-auto hidden md:inline">
          {isCoarsePointer
            ? isNote
              ? 'Toque em Salvar nota para registrar'
              : 'Toque em Enviar para mandar'
            : isNote
              ? 'Enter salva · Shift+Enter quebra linha'
              : 'Enter envia · Shift+Enter quebra linha'}
        </span>
      </div>

      {statusError || aiMessage || showSendError ? (
        <div className="flex flex-col gap-1 px-1" role="alert">
          {statusError ? (
            <p className="flex items-center gap-1.5 text-xs text-danger-soft-foreground">
              <AlertCircle className="size-3.5" aria-hidden />
              {statusError}
              <button type="button" className="underline" onClick={() => { setUploadError(null); setAttachmentError(null); }}>
                Ok
              </button>
            </p>
          ) : null}
          {aiMessage ? (
            <p className="flex items-center gap-1.5 text-xs text-danger-soft-foreground">
              <AlertCircle className="size-3.5" aria-hidden />
              {aiMessage}
            </p>
          ) : null}
          {showSendError ? (
            <p className="flex items-center gap-1.5 text-xs text-danger-soft-foreground">
              <AlertCircle className="size-3.5" aria-hidden />
              {sendError?.message ?? 'Não foi possível enviar a mensagem.'}
            </p>
          ) : null}
        </div>
      ) : null}

      <TemplatePicker
        open={templatePickerOpen}
        contactName={contactName}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(template) => {
          setTemplatePickerOpen(false);
          setMode('reply');
          insertText(template.body ?? template.content ?? '');
        }}
      />
      <NewQuickReplyDialog
        open={newReplyOpen}
        onOpenChange={setNewReplyOpen}
        onCreate={(reply) =>
          setQuickReplies((current) =>
            current.some((item) => item.label === reply.label && item.text === reply.text) ? current : [...current, reply],
          )
        }
      />
    </div>
  );
});

Composer.displayName = 'Composer';

export default Composer;
