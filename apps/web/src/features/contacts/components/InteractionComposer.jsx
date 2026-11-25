import { useId, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx';
import { INTERACTION_CHANNELS } from './ContactTimeline.jsx';

/** Registra interação manual: { channel, direction, summary } (POST /api/contacts/:id/interactions). */
const InteractionComposer = ({ onSubmit, isSubmitting = false }) => {
  const [summary, setSummary] = useState('');
  const [channel, setChannel] = useState('PHONE');
  const [direction, setDirection] = useState('OUTBOUND');
  const summaryId = useId();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = summary.trim();
    if (!text) {
      return;
    }
    const ok = await onSubmit?.({ channel, direction, summary: text });
    if (ok !== false) {
      setSummary('');
    }
  };

  return (
    <form className="space-y-3 rounded-lg border border-border bg-surface p-3" onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          size="sm"
          value={channel}
          onValueChange={(value) => value && setChannel(value)}
          aria-label="Canal"
          className="flex-wrap gap-1"
        >
          {INTERACTION_CHANNELS.map((entry) => (
            <ToggleGroupItem key={entry.value} value={entry.value} className="rounded-md px-2.5 first:rounded-md last:rounded-md">
              <entry.icon aria-hidden="true" />
              {entry.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          type="single"
          size="sm"
          value={direction}
          onValueChange={(value) => value && setDirection(value)}
          aria-label="Quem iniciou"
          className="ml-auto gap-1"
        >
          <ToggleGroupItem value="OUTBOUND" className="rounded-md px-2.5 first:rounded-md last:rounded-md">
            Feita por nós
          </ToggleGroupItem>
          <ToggleGroupItem value="INBOUND" className="rounded-md px-2.5 first:rounded-md last:rounded-md">
            Recebida
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Label htmlFor={summaryId} className="sr-only">
        Resumo da interação
      </Label>
      <Textarea
        id={summaryId}
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Ex.: Liguei, cliente pediu simulação de portabilidade INSS para amanhã."
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">{summary.length}/500</span>
        <Button type="submit" size="sm" disabled={isSubmitting || !summary.trim()}>
          {isSubmitting ? 'Registrando…' : 'Registrar interação'}
        </Button>
      </div>
    </form>
  );
};

export default InteractionComposer;
