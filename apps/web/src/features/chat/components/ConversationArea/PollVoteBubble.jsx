import { ListChecks } from 'lucide-react';

import { cn } from '@/lib/utils.js';

const formatPollTimestamp = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const PollVoteContent = ({
  question,
  pollId,
  totalVotes,
  totalVoters,
  updatedAtIso,
  selectedOptions = [],
  textContent,
  caption,
}) => {
  const formattedTimestamp = formatPollTimestamp(updatedAtIso);
  const hasSelections = selectedOptions.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ListChecks className="h-4 w-4" aria-hidden="true" />
        Resposta de enquete
      </div>
      {question ? <span className="text-xs text-foreground-muted">{question}</span> : null}
      <div className="flex flex-col gap-1 rounded-lg bg-surface-overlay-quiet px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
          Opções escolhidas
        </span>
        {hasSelections ? (
          <ul className="ml-4 list-disc space-y-1 text-xs text-foreground">
            {selectedOptions.map((selection, index) => (
              <li key={selection.id ?? index}>{selection.title}</li>
            ))}
          </ul>
        ) : (
          <span className="text-xs text-foreground-muted">Nenhuma opção identificada</span>
        )}
      </div>
      {pollId ? (
        <span className="text-[10px] uppercase tracking-wide text-foreground-muted">ID da enquete: {pollId}</span>
      ) : null}
      {totalVotes !== null || totalVoters !== null ? (
        <div className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-foreground-muted">
          {totalVotes !== null ? <span>Total de votos: {totalVotes}</span> : null}
          {totalVoters !== null ? <span>Total de participantes: {totalVoters}</span> : null}
        </div>
      ) : null}
      {formattedTimestamp ? (
        <span className="text-[10px] uppercase tracking-wide text-foreground-muted">Atualizado em: {formattedTimestamp}</span>
      ) : null}
      {textContent ? (
        <p className="whitespace-pre-wrap break-words text-xs text-foreground-muted">{textContent}</p>
      ) : null}
      {caption ? <p className="text-xs text-foreground-muted">{caption}</p> : null}
    </div>
  );
};

const PollOptionsContent = ({ title, options = [], totalVotes, totalVoters, caption, isMetadataMissing }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <ListChecks className="h-4 w-4" aria-hidden="true" />
      {title}
    </div>
    {options.length > 0 ? (
      <ul className="ml-5 list-disc space-y-1 text-xs text-foreground-muted">
        {options.map((option, index) => (
          <li key={option.id ?? index} className="flex items-center gap-2">
            <span className={cn('text-foreground-muted', option.isSelected && 'font-semibold text-foreground')}>
              {option.label}
            </span>
            {option.votes !== null && option.votes !== undefined ? (
              <span className="rounded-full bg-surface-overlay-quiet px-2 py-0.5 text-[10px] text-foreground">
                {option.votes} voto{option.votes === 1 ? '' : 's'}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    ) : (
      <div className="flex flex-col gap-1 rounded-lg bg-surface-overlay-quiet px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
          Opções indisponíveis
        </span>
        <ul className="ml-4 list-disc space-y-1 text-xs text-foreground-muted">
          <li className="italic">
            {isMetadataMissing
              ? 'As opções desta enquete ainda não foram recebidas.'
              : 'Nenhuma opção disponível.'}
          </li>
        </ul>
      </div>
    )}
    {totalVotes !== null || totalVoters !== null ? (
      <span className="text-[10px] uppercase tracking-wide text-foreground-muted">
        {totalVotes !== null ? `Total de votos: ${totalVotes}` : null}
        {totalVotes !== null && totalVoters !== null ? ' • ' : null}
        {totalVoters !== null ? `Total de participantes: ${totalVoters}` : null}
      </span>
    ) : null}
    {caption ? <p className="text-xs text-foreground-muted">{caption}</p> : null}
  </div>
);

export const PollVoteBubble = ({
  variant,
  question,
  pollId,
  totalVotes,
  totalVoters,
  updatedAtIso,
  selectedOptions,
  textContent,
  caption,
  options,
  title,
  isMetadataMissing,
}) => {
  if (variant === 'poll') {
    return (
      <PollOptionsContent
        title={title ?? 'Enquete'}
        options={options}
        totalVotes={totalVotes ?? null}
        totalVoters={totalVoters ?? null}
        caption={caption}
        isMetadataMissing={Boolean(isMetadataMissing)}
      />
    );
  }

  return (
    <PollVoteContent
      question={question}
      pollId={pollId}
      totalVotes={totalVotes ?? null}
      totalVoters={totalVoters ?? null}
      updatedAtIso={updatedAtIso}
      selectedOptions={Array.isArray(selectedOptions) ? selectedOptions : []}
      textContent={textContent}
      caption={caption}
    />
  );
};

export default PollVoteBubble;
