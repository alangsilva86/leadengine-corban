import { Lock } from 'lucide-react';
import { formatMessageTime } from './utils/presentation.js';

const resolveNoteAuthor = (note, currentUser) => {
  if (!note) return null;
  const authorId = note.authorId ?? note.userId ?? note.author?.id ?? null;
  if (authorId && currentUser?.id && String(authorId) === String(currentUser.id)) return 'Você';
  const name = note.authorName ?? note.author?.name ?? note.user?.name ?? note.userName ?? null;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
};

/** Nota interna: cartão de largura total, nunca enviado ao cliente. */
const NoteCard = ({ entry, currentUser = null }) => {
  const note = entry?.payload ?? {};
  const body = note.body ?? note.content ?? note.text ?? '';
  const author = resolveNoteAuthor(note, currentUser);
  const time = formatMessageTime(entry?.date ?? note.createdAt);

  return (
    <article
      className="my-3 w-full rounded-lg border border-border bg-bubble-note px-3.5 py-2.5 text-sm text-foreground"
      aria-label="Nota interna"
    >
      <header className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lock className="size-3.5" aria-hidden />
        <span>Nota interna · visível só para a equipe</span>
      </header>
      <p className="whitespace-pre-wrap break-words leading-snug">{body}</p>
      {author || time ? (
        <footer className="mt-1 text-right text-[11px] text-muted-foreground">
          {[author, time].filter(Boolean).join(' · ')}
        </footer>
      ) : null}
    </article>
  );
};

export default NoteCard;
