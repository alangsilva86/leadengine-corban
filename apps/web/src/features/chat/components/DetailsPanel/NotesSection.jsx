import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Button } from '@/components/ui/button.jsx';
import { StickyNote } from 'lucide-react';

export const NotesSection = ({ notes = [], onCreate, loading }) => {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onCreate?.(trimmed);
    setValue('');
  };

  return (
    <Card className="border-slate-800/60 bg-slate-950/80 text-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <StickyNote className="h-4 w-4 text-amber-300" /> Notas internas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs">
        {notes.length === 0 ? (
          <p className="text-slate-500">Nenhuma nota registrada.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-slate-800/60 bg-slate-900/70 p-2">
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
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Adicionar nota interna (/nota)"
          className="min-h-[80px] border-slate-800 bg-slate-900/70 text-slate-100"
        />
        <Button size="sm" onClick={handleSubmit} disabled={loading}>
          Registrar nota
        </Button>
      </CardFooter>
    </Card>
  );
};

export default NotesSection;
