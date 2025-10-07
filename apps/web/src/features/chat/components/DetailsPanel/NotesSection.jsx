import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Button } from '@/components/ui/button.jsx';
import { StickyNote } from 'lucide-react';

export const NotesSection = forwardRef(({ notes = [], onCreate, loading }, ref) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focusComposer: () => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
  }));

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onCreate?.(trimmed);
    setValue('');
  };

  return (
    <Card className="border-0 bg-slate-950/25 text-slate-100 shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-white/5 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <StickyNote className="h-4 w-4 text-amber-300" /> Notas internas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs text-slate-300">
        {notes.length === 0 ? (
          <p className="text-slate-500">Nenhuma nota registrada.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => (
              <div key={note.id} className="rounded-2xl bg-slate-900/35 p-3 ring-1 ring-white/5">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{note.authorName ?? 'Agente'}</span>
                  <span>{new Date(note.createdAt ?? note.updatedAt ?? Date.now()).toLocaleString('pt-BR')}</span>
                </div>
                <p className="mt-1 text-slate-200">{note.body}</p>
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
          className="min-h-[80px] rounded-[18px] border-none bg-slate-950/35 text-slate-100 placeholder:text-slate-500 ring-1 ring-white/5"
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
