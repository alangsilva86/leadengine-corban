import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
const PollVoteContent = ({ question, pollId, totalVotes, totalVoters, updatedAtIso, selectedOptions = [], textContent, caption, }) => {
    const formattedTimestamp = formatPollTimestamp(updatedAtIso);
    const hasSelections = selectedOptions.length > 0;
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-semibold text-foreground", children: [_jsx(ListChecks, { className: "h-4 w-4", "aria-hidden": "true" }), "Resposta de enquete"] }), question ? _jsx("span", { className: "text-xs text-foreground-muted", children: question }) : null, _jsxs("div", { className: "flex flex-col gap-1 rounded-lg bg-surface-overlay-quiet px-3 py-2", children: [_jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-foreground-muted", children: "Op\u00E7\u00F5es escolhidas" }), hasSelections ? (_jsx("ul", { className: "ml-4 list-disc space-y-1 text-xs text-foreground", children: selectedOptions.map((selection, index) => (_jsx("li", { children: selection.title }, selection.id ?? index))) })) : (_jsx("span", { className: "text-xs text-foreground-muted", children: "Nenhuma op\u00E7\u00E3o identificada" }))] }), pollId ? (_jsxs("span", { className: "text-[10px] uppercase tracking-wide text-foreground-muted", children: ["ID da enquete: ", pollId] })) : null, totalVotes !== null || totalVoters !== null ? (_jsxs("div", { className: "flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-foreground-muted", children: [totalVotes !== null ? _jsxs("span", { children: ["Total de votos: ", totalVotes] }) : null, totalVoters !== null ? _jsxs("span", { children: ["Total de participantes: ", totalVoters] }) : null] })) : null, formattedTimestamp ? (_jsxs("span", { className: "text-[10px] uppercase tracking-wide text-foreground-muted", children: ["Atualizado em: ", formattedTimestamp] })) : null, textContent ? (_jsx("p", { className: "whitespace-pre-wrap break-words text-xs text-foreground-muted", children: textContent })) : null, caption ? _jsx("p", { className: "text-xs text-foreground-muted", children: caption }) : null] }));
};
const PollOptionsContent = ({ title, options = [], totalVotes, totalVoters, caption, isMetadataMissing }) => (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-semibold text-foreground", children: [_jsx(ListChecks, { className: "h-4 w-4", "aria-hidden": "true" }), title] }), options.length > 0 ? (_jsx("ul", { className: "ml-5 list-disc space-y-1 text-xs text-foreground-muted", children: options.map((option, index) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx("span", { className: cn('text-foreground-muted', option.isSelected && 'font-semibold text-foreground'), children: option.label }), option.votes !== null && option.votes !== undefined ? (_jsxs("span", { className: "rounded-full bg-surface-overlay-quiet px-2 py-0.5 text-[10px] text-foreground", children: [option.votes, " voto", option.votes === 1 ? '' : 's'] })) : null] }, option.id ?? index))) })) : (_jsxs("div", { className: "flex flex-col gap-1 rounded-lg bg-surface-overlay-quiet px-3 py-2", children: [_jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-foreground-muted", children: "Op\u00E7\u00F5es indispon\u00EDveis" }), _jsx("ul", { className: "ml-4 list-disc space-y-1 text-xs text-foreground-muted", children: _jsx("li", { className: "italic", children: isMetadataMissing
                            ? 'As opções desta enquete ainda não foram recebidas.'
                            : 'Nenhuma opção disponível.' }) })] })), totalVotes !== null || totalVoters !== null ? (_jsxs("span", { className: "text-[10px] uppercase tracking-wide text-foreground-muted", children: [totalVotes !== null ? `Total de votos: ${totalVotes}` : null, totalVotes !== null && totalVoters !== null ? ' • ' : null, totalVoters !== null ? `Total de participantes: ${totalVoters}` : null] })) : null, caption ? _jsx("p", { className: "text-xs text-foreground-muted", children: caption }) : null] }));
export const PollVoteBubble = ({ variant, question, pollId, totalVotes, totalVoters, updatedAtIso, selectedOptions, textContent, caption, options, title, isMetadataMissing, }) => {
    if (variant === 'poll') {
        return (_jsx(PollOptionsContent, { title: title ?? 'Enquete', options: options, totalVotes: totalVotes ?? null, totalVoters: totalVoters ?? null, caption: caption, isMetadataMissing: Boolean(isMetadataMissing) }));
    }
    return (_jsx(PollVoteContent, { question: question, pollId: pollId, totalVotes: totalVotes ?? null, totalVoters: totalVoters ?? null, updatedAtIso: updatedAtIso, selectedOptions: Array.isArray(selectedOptions) ? selectedOptions : [], textContent: textContent, caption: caption }));
};
export default PollVoteBubble;
