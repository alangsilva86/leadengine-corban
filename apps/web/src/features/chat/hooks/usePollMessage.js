import { useMemo } from 'react';
import { PollMetadataSchema } from '@ticketz/contracts';

const POLL_PLACEHOLDER_MESSAGES = new Set(['[Mensagem recebida via WhatsApp]', '[Mensagem]']);

const getFirstNonEmptyString = (...candidates) => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
};

const getFirstInteger = (...candidates) => {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isInteger(candidate)) {
      return candidate;
    }
  }
  return null;
};

const buildPollOptionsLookup = (metadataPoll, pollChoiceMetadata, interactivePoll) => {
  const lookup = new Map();

  const register = (option, index) => {
    if (option === null || option === undefined) {
      return;
    }

    const buildEntry = (label, normalizedIndex) => ({
      label: label ?? `Opção ${normalizedIndex + 1}`,
      index: normalizedIndex,
    });

    if (typeof option === 'string') {
      const trimmed = option.trim();
      if (!trimmed) {
        return;
      }
      const entry = buildEntry(trimmed, index);
      if (!lookup.has(trimmed)) {
        lookup.set(trimmed, entry);
      }
      const indexKey = `__index:${index}`;
      if (!lookup.has(indexKey)) {
        lookup.set(indexKey, entry);
      }
      return;
    }

    if (typeof option !== 'object') {
      return;
    }

    const normalizedIndexCandidate = getFirstInteger(option.index, option.position);
    const normalizedIndex = normalizedIndexCandidate !== null && normalizedIndexCandidate >= 0 ? normalizedIndexCandidate : index;

    const labelCandidate = getFirstNonEmptyString(
      option.title,
      option.text,
      option.name,
      option.description,
      option.optionName,
      option.label,
      option.displayName
    );

    const entry = buildEntry(labelCandidate, normalizedIndex);

    const idCandidate = getFirstNonEmptyString(option.id, option.optionId, option.key, option.value);

    if (idCandidate && !lookup.has(idCandidate)) {
      lookup.set(idCandidate, entry);
    }

    const indexKey = `__index:${normalizedIndex}`;
    if (!lookup.has(indexKey)) {
      lookup.set(indexKey, entry);
    }
  };

  const registerFromArray = (value) => {
    if (!Array.isArray(value)) {
      return;
    }
    value.forEach((option, index) => register(option, index));
  };

  registerFromArray(metadataPoll?.options);
  registerFromArray(pollChoiceMetadata?.options);
  registerFromArray(interactivePoll?.options);

  return lookup;
};

const buildSelectedOptions = (metadataPoll, pollChoiceMetadata, pollOptionsLookup) => {
  const selections = [];
  const seen = new Set();

  const pushSelection = (id, title, indexHint, labelFallback) => {
    const normalizedId = getFirstNonEmptyString(id);
    const normalizedTitleCandidate = getFirstNonEmptyString(title, labelFallback);
    const lookupById = normalizedId ? pollOptionsLookup.get(normalizedId) : null;
    const lookupByIndex = typeof indexHint === 'number' ? pollOptionsLookup.get(`__index:${indexHint}`) : null;
    const resolvedIndex =
      typeof indexHint === 'number'
        ? indexHint
        : lookupById?.index ?? lookupByIndex?.index ?? selections.length;
    const resolvedTitle =
      normalizedTitleCandidate ??
      lookupById?.label ??
      lookupByIndex?.label ??
      (normalizedId ? normalizedId : `Opção ${resolvedIndex + 1}`);
    const key = normalizedId ?? `__synthetic:${resolvedIndex}:${resolvedTitle}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    selections.push({
      id: normalizedId ?? key,
      title: resolvedTitle,
      index: resolvedIndex,
    });
  };

  const fromMetadata = Array.isArray(metadataPoll?.selectedOptions) ? metadataPoll.selectedOptions : [];
  fromMetadata.forEach((selection, index) => {
    if (selection === null || selection === undefined) {
      return;
    }
    if (typeof selection === 'string') {
      const normalized = selection.trim();
      if (!normalized) {
        return;
      }
      pushSelection(normalized, normalized, index, normalized);
      return;
    }
    if (typeof selection !== 'object') {
      return;
    }
    const idCandidate = getFirstNonEmptyString(selection.id, selection.optionId);
    const indexCandidate = getFirstInteger(selection.index, selection.position);
    const titleCandidate = getFirstNonEmptyString(
      selection.title,
      selection.text,
      selection.name,
      selection.optionName,
      selection.label,
      selection.description,
      selection.displayName
    );
    const optionNameCandidate = getFirstNonEmptyString(selection.optionName, selection.label, selection.displayName);
    pushSelection(idCandidate ?? null, titleCandidate ?? null, indexCandidate ?? index, optionNameCandidate ?? null);
  });

  const pollChoiceVote = pollChoiceMetadata && typeof pollChoiceMetadata.vote === 'object' ? pollChoiceMetadata.vote : null;
  const voteSelections = Array.isArray(pollChoiceVote?.selectedOptions) ? pollChoiceVote.selectedOptions : [];
  voteSelections.forEach((selection, index) => {
    if (selection === null || selection === undefined) {
      return;
    }
    if (typeof selection === 'string') {
      const normalized = selection.trim();
      if (!normalized) {
        return;
      }
      pushSelection(normalized, normalized, index, normalized);
      return;
    }
    if (typeof selection !== 'object') {
      return;
    }
    const idCandidate = getFirstNonEmptyString(selection.id, selection.optionId);
    const indexCandidate = getFirstInteger(selection.index, selection.position);
    const titleCandidate = getFirstNonEmptyString(
      selection.title,
      selection.text,
      selection.name,
      selection.optionName,
      selection.label,
      selection.description,
      selection.displayName
    );
    const optionNameCandidate = getFirstNonEmptyString(selection.optionName, selection.label, selection.displayName);
    pushSelection(idCandidate ?? null, titleCandidate ?? null, indexCandidate ?? index, optionNameCandidate ?? null);
  });

  if (selections.length === 0) {
    const optionIds = Array.isArray(pollChoiceVote?.optionIds) ? pollChoiceVote.optionIds : [];
    optionIds.forEach((optionId, index) => {
      if (typeof optionId !== 'string') {
        return;
      }
      const normalizedId = optionId.trim();
      if (!normalizedId) {
        return;
      }
      const lookupEntry = pollOptionsLookup.get(normalizedId) ?? pollOptionsLookup.get(`__index:${index}`);
      pushSelection(
        normalizedId,
        lookupEntry?.label ?? normalizedId,
        lookupEntry?.index ?? index,
        lookupEntry?.label ?? normalizedId
      );
    });
  }

  selections.sort((a, b) => a.index - b.index);
  return selections;
};

const normalizePollOptions = (optionsSource, pollOptionsLookup, pollOptionTotals, pollSelectedIdSet, pollSelectedTitleSet) => {
  if (!Array.isArray(optionsSource)) {
    return [];
  }

  return optionsSource.map((option, index) => {
    if (option === null || option === undefined) {
      return {
        id: `__synthetic:${index}`,
        label: `Opção ${index + 1}`,
        votes: null,
        isSelected: false,
        index,
      };
    }

    if (typeof option === 'string') {
      const normalizedId = option.trim();
      const lookupEntry =
        (normalizedId ? pollOptionsLookup.get(normalizedId) : null) ?? pollOptionsLookup.get(`__index:${index}`);
      const label = normalizedId || lookupEntry?.label || `Opção ${index + 1}`;
      const votes =
        normalizedId && pollOptionTotals && typeof pollOptionTotals === 'object'
          ? pollOptionTotals[normalizedId] ?? null
          : null;
      const isSelected =
        (normalizedId && pollSelectedIdSet.has(normalizedId)) ||
        pollSelectedTitleSet.has(label) ||
        (lookupEntry?.label ? pollSelectedTitleSet.has(lookupEntry.label) : false);
      return {
        id: normalizedId || `__synthetic:${index}`,
        label,
        votes,
        isSelected,
        index: lookupEntry?.index ?? index,
      };
    }

    if (typeof option !== 'object') {
      return {
        id: `__synthetic:${index}`,
        label: `Opção ${index + 1}`,
        votes: null,
        isSelected: false,
        index,
      };
    }

    const normalizedId = getFirstNonEmptyString(option.id, option.optionId, option.key, option.value);
    const indexCandidate = getFirstInteger(option.index, option.position);
    const normalizedIndex = indexCandidate !== null && indexCandidate >= 0 ? indexCandidate : index;
    const lookupEntry =
      (normalizedId ? pollOptionsLookup.get(normalizedId) : null) ?? pollOptionsLookup.get(`__index:${normalizedIndex}`);
    const labelCandidate = getFirstNonEmptyString(
      option.title,
      option.text,
      option.name,
      option.description,
      option.optionName,
      option.label,
      option.displayName,
      lookupEntry?.label
    );
    const label = labelCandidate ?? (normalizedId ? normalizedId : `Opção ${normalizedIndex + 1}`);
    const votesFromOption =
      typeof option.votes === 'number' ? option.votes : typeof option.count === 'number' ? option.count : null;
    const votesFromTotals =
      normalizedId && pollOptionTotals && typeof pollOptionTotals === 'object'
        ? pollOptionTotals[normalizedId] ?? null
        : null;
    const votes = votesFromOption ?? votesFromTotals ?? null;
    const isSelected =
      (normalizedId && pollSelectedIdSet.has(normalizedId)) ||
      pollSelectedTitleSet.has(label) ||
      (lookupEntry?.label ? pollSelectedTitleSet.has(lookupEntry.label) : false);

    return {
      id: normalizedId ?? `__synthetic:${normalizedIndex}`,
      label,
      votes,
      isSelected,
      index: normalizedIndex,
    };
  });
};

export const usePollMessage = ({ message, messageType, rawTextContent }) =>
  useMemo(() => {
    const normalizedType =
      typeof messageType === 'string'
        ? messageType.toLowerCase()
        : typeof message?.type === 'string'
          ? message.type.toLowerCase()
          : 'text';

    const rawText = typeof rawTextContent === 'string' ? rawTextContent : '';
    const trimmedRawText = rawText.trim();
    const metadata = message && typeof message.metadata === 'object' ? message.metadata : {};
    const metadataParse = PollMetadataSchema.safeParse(metadata);
    const pollMetadata = metadataParse.success ? metadataParse.data : {};
    const metadataPoll = pollMetadata?.poll ?? null;
    const interactivePoll = pollMetadata?.interactive?.poll ?? null;
    const pollChoiceMetadata = pollMetadata?.pollChoice ?? null;
    const pollLikeMetadata = Boolean(
      pollMetadata?.origin === 'poll_choice' || metadataPoll || pollChoiceMetadata || interactivePoll
    );

    const hasMeaningfulText = trimmedRawText.length > 0 && !POLL_PLACEHOLDER_MESSAGES.has(trimmedRawText);

    const shouldForceText =
      hasMeaningfulText &&
      (normalizedType === 'poll_update' ||
        normalizedType === 'poll' ||
        (pollLikeMetadata && normalizedType !== 'text'));

    const pollOptionsLookup = buildPollOptionsLookup(metadataPoll, pollChoiceMetadata, interactivePoll);
    const pollSelectedOptions = buildSelectedOptions(metadataPoll, pollChoiceMetadata, pollOptionsLookup);

    const pollFallbackText =
      pollSelectedOptions.length > 0
        ? pollSelectedOptions
            .map((selection) => (typeof selection.title === 'string' ? selection.title.trim() : null))
            .filter(Boolean)
            .join(', ')
        : null;

    const textContent =
      pollFallbackText && trimmedRawText && POLL_PLACEHOLDER_MESSAGES.has(trimmedRawText)
        ? pollFallbackText
        : rawText;

    if (typeof window !== 'undefined') {
      const silenceLogs = Boolean(window.__LE_SILENCE_POLL_LOGS);
      if (!silenceLogs && (metadataPoll || pollChoiceMetadata)) {
        const pollLogSelections = pollSelectedOptions.map((selection) => selection.title);
        // eslint-disable-next-line no-console
        console.info('🪄 Etapa6-Render: bolha decifrada', {
          messageId: message?.id,
          hasPlaceholder: POLL_PLACEHOLDER_MESSAGES.has(trimmedRawText),
          usedFallback: textContent === pollFallbackText && pollFallbackText !== null,
          selectedOptions: pollLogSelections,
          finalText: textContent,
        });
      }
    }

    const pollSelectedIdSet = new Set(
      pollSelectedOptions
        .map((entry) => (typeof entry.id === 'string' ? entry.id : null))
        .filter((id) => id && !id.startsWith('__synthetic:'))
    );

    const pollSelectedTitleSet = new Set(
      pollSelectedOptions
        .map((entry) => (typeof entry.title === 'string' ? entry.title : null))
        .filter(Boolean)
    );

    const pollAggregates = metadataPoll?.aggregates ?? interactivePoll?.aggregates ?? null;
    const pollOptionTotals =
      metadataPoll?.optionTotals ??
      (pollAggregates && typeof pollAggregates === 'object' ? pollAggregates.optionTotals : null) ??
      interactivePoll?.optionTotals ??
      null;

    const pollTotalVotes =
      typeof metadataPoll?.totalVotes === 'number'
        ? metadataPoll.totalVotes
        : typeof pollAggregates?.totalVotes === 'number'
          ? pollAggregates.totalVotes
          : typeof interactivePoll?.totalVotes === 'number'
            ? interactivePoll.totalVotes
            : null;

    const pollTotalVoters =
      typeof metadataPoll?.totalVoters === 'number'
        ? metadataPoll.totalVoters
        : typeof pollAggregates?.totalVoters === 'number'
          ? pollAggregates.totalVoters
          : typeof interactivePoll?.totalVoters === 'number'
            ? interactivePoll.totalVoters
            : null;

    const pollId = getFirstNonEmptyString(
      metadataPoll?.pollId,
      metadataPoll?.id,
      pollChoiceMetadata?.pollId,
      pollChoiceMetadata?.id
    );

    const pollQuestion = getFirstNonEmptyString(
      metadataPoll?.question,
      metadataPoll?.title,
      metadataPoll?.name,
      interactivePoll?.question,
      interactivePoll?.title,
      interactivePoll?.name
    );

    const pollUpdatedAtIso = getFirstNonEmptyString(
      metadataPoll?.updatedAt,
      metadataPoll?.timestamp,
      pollChoiceMetadata?.vote?.timestamp
    );

    const pollOptionsSource = Array.isArray(metadataPoll?.options) && metadataPoll.options.length > 0
      ? metadataPoll.options
      : Array.isArray(interactivePoll?.options)
        ? interactivePoll.options
        : [];

    const normalizedPollOptions = normalizePollOptions(
      pollOptionsSource,
      pollOptionsLookup,
      pollOptionTotals,
      pollSelectedIdSet,
      pollSelectedTitleSet
    );

    const isMetadataMissing = !metadataPoll && !interactivePoll && pollOptionsSource.length === 0;
    const pollTitleSource = pollQuestion ?? textContent;
    const pollTitle = pollTitleSource && pollTitleSource.trim().length > 0 ? pollTitleSource.trim() : 'Enquete';

    return {
      textContent,
      shouldForceText,
      pollFallbackText,
      pollMetadata: {
        id: pollId,
        question: pollQuestion,
        updatedAtIso: pollUpdatedAtIso,
        totalVotes: pollTotalVotes,
        totalVoters: pollTotalVoters,
        hasMetadata: Boolean(metadataPoll || interactivePoll || pollChoiceMetadata),
      },
      voteBubble: {
        shouldRender: pollLikeMetadata || pollSelectedOptions.length > 0,
        question: pollQuestion,
        pollId,
        totalVotes: pollTotalVotes,
        totalVoters: pollTotalVoters,
        updatedAtIso: pollUpdatedAtIso,
        selectedOptions: pollSelectedOptions,
        textContent: textContent && textContent.trim().length > 0 ? textContent : null,
      },
      pollBubble: {
        shouldRender: normalizedType === 'poll',
        title: pollTitle,
        options: normalizedPollOptions,
        totalVotes: pollTotalVotes,
        totalVoters: pollTotalVoters,
        isMetadataMissing,
      },
    };
  }, [message, messageType, rawTextContent]);

export default usePollMessage;
