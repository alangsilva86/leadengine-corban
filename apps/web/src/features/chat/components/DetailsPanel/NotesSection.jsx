import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Button } from '@/components/ui/button.jsx';
import { StickyNote } from 'lucide-react';

export const NotesSection = forwardRef(function NotesSection({ notes = [], onCreate, loading }, ref) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      focusComposer: () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        if (typeof textarea.scrollIntoView === 'function') {
          textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
    }),
    []
  );

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onCreate?.(trimmed);
    setValue('');
  };

  return (
    <Card className="border-0 bg-surface-overlay-quiet text-foreground shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-surface-overlay-glass-border backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <StickyNote className="h-4 w-4 text-amber-300" /> Notas internas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs text-foreground-muted">
        {notes.length === 0 ? (
          <p className="text-foreground-muted">Nenhuma nota registrada.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => (
              <div key={note.id} className="rounded-2xl bg-surface-overlay-quiet p-3 ring-1 ring-surface-overlay-glass-border">
                <div className="flex justify-between text-xs text-foreground-muted">
                  <span>{note.authorName ?? 'Agente'}</span>
                  <span>{new Date(note.createdAt ?? note.updatedAt ?? Date.now()).toLocaleString('pt-BR')}</span>
                </div>
                <p className="mt-1 text-foreground">{note.body}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Adicionar nota interna (/nota)"
          className="min-h-[80px] rounded-[18px] border-none bg-surface-overlay-quiet text-foreground placeholder:text-foreground-muted ring-1 ring-surface-overlay-glass-border"
        />
        <Button
          size="sm"
          className="w-full rounded-full bg-emerald-500 text-white shadow-[0_18px_36px_-24px_rgba(16,185,129,0.6)] hover:bg-emerald-400"
          onClick={handleSubmit}
          disabled={loading}
        >
          Registrar nota
        </Button>
      </CardFooter>
    </Card>
  );
});

NotesSection.displayName = 'NotesSection';

export default NotesSection;
