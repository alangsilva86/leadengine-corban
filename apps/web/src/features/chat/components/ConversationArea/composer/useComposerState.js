import { useCallback, useMemo, useState } from 'react';
import { useComposerDraft } from '../../../hooks/useComposerDraft.js';

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES =
  'image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip';

const formatMegabytes = (bytes) => `${Math.round(bytes / (1024 * 1024))} MB`;

/**
 * Estado do composer: texto (rascunho por conversa e por modo), modo
 * ("Responder" | "Nota interna"), anexos validados e erros de anexo.
 */
export const useComposerState = ({ ticketId = null } = {}) => {
  const [mode, setMode] = useState('reply');
  const replyDraft = useComposerDraft(ticketId ?? null);
  const noteDraft = useComposerDraft(ticketId ? `${ticketId}:note` : null);
  // Sem conversa (ex.: testes isolados) o texto fica só em memória.
  const [localValue, setLocalValue] = useState({ reply: '', note: '' });
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState(null);

  const hasStore = Boolean(ticketId);
  const value = hasStore ? (mode === 'note' ? noteDraft.draft : replyDraft.draft) : localValue[mode];

  const setValue = useCallback(
    (next) => {
      const resolve = (current) => (typeof next === 'function' ? next(current ?? '') : next ?? '');
      if (!hasStore) {
        setLocalValue((current) => ({ ...current, [mode]: resolve(current[mode]) }));
        return;
      }
      const target = mode === 'note' ? noteDraft : replyDraft;
      target.setDraft(resolve(target.draft));
    },
    [hasStore, mode, noteDraft, replyDraft],
  );

  const clearValue = useCallback(() => {
    if (!hasStore) {
      setLocalValue((current) => ({ ...current, [mode]: '' }));
      return;
    }
    (mode === 'note' ? noteDraft : replyDraft).clear();
  }, [hasStore, mode, noteDraft, replyDraft]);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    const rejected = [];
    setAttachments((current) => {
      const room = MAX_ATTACHMENTS - current.length;
      const accepted = [];
      files.forEach((file) => {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          rejected.push(`"${file.name}" passa de ${formatMegabytes(MAX_ATTACHMENT_BYTES)}.`);
          return;
        }
        if (accepted.length >= room) {
          rejected.push(`Você pode anexar até ${MAX_ATTACHMENTS} arquivos por mensagem.`);
          return;
        }
        accepted.push({
          id: `${file.name}-${file.size}-${Date.now()}-${accepted.length}`,
          name: file.name,
          size: file.size,
          type: file.type,
          file,
        });
      });
      return accepted.length > 0 ? [...current, ...accepted] : current;
    });
    const unique = Array.from(new Set(rejected));
    setAttachmentError(unique.length > 0 ? unique.join(' ') : null);
  }, []);

  const removeAttachment = useCallback((id) => {
    setAttachments((current) => current.filter((item) => item.id !== id));
    setAttachmentError(null);
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setAttachmentError(null);
  }, []);

  const trimmed = useMemo(() => (value ?? '').trim(), [value]);

  return {
    mode,
    setMode,
    value: value ?? '',
    trimmed,
    setValue,
    clearValue,
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    attachmentError,
    setAttachmentError,
  };
};

export default useComposerState;
