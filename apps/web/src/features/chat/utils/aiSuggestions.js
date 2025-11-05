const coerceString = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value && typeof value.toString === 'function') {
    const result = value.toString();
    return typeof result === 'string' && result.trim().length > 0 ? result.trim() : null;
  }
  return null;
};

const coerceObjectLine = (value, { titleKey = 'title', bodyKey = 'message' } = {}) => {
  if (!value || typeof value !== 'object') {
    return coerceString(value);
  }

  const title =
    typeof value[titleKey] === 'string' && value[titleKey].trim().length > 0
      ? value[titleKey].trim()
      : null;
  const body =
    typeof value[bodyKey] === 'string' && value[bodyKey].trim().length > 0
      ? value[bodyKey].trim()
      : null;

  if (title && body) {
    return `${title}: ${body}`;
  }

  if (title) {
    return title;
  }

  if (body) {
    return body;
  }

  return coerceString(value);
};

const toList = (value, options = undefined) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => (options ? coerceObjectLine(item, options) : coerceString(item)))
      .filter((item) => typeof item === 'string' && item.length > 0);
  }

  const asString = coerceString(value);
  if (!asString) return [];

  return asString
    .split(/\r?\n|\u2022|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const normalizeConfidence = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric < 0) {
    return null;
  }

  if (numeric <= 1) {
    return Math.round(numeric * 100);
  }

  if (numeric <= 100) {
    return Math.round(numeric);
  }

  return null;
};

export const extractAiSuggestion = (rawPayload = {}) => {
  const payload = rawPayload?.suggestion ?? rawPayload?.data ?? rawPayload;
  const suggestionRoot = payload?.suggestion ?? payload;

const pickList = (candidates) => {
  for (const candidate of candidates) {
    const { value, options } = candidate;
    const list = toList(value, options);
    if (list.length > 0) {
      return list;
    }
  }
  return [];
};

const pickFirstString = (candidates) => {
  for (const candidate of candidates) {
    const value = typeof candidate === 'function' ? candidate() : candidate;
    const coerced = coerceString(value);
    if (coerced) {
      return coerced;
    }
  }
  return null;
};

  const firstSuggestion = Array.isArray(suggestionRoot?.suggestions) ? suggestionRoot.suggestions[0] : null;

  const nextStep = pickFirstString([
    suggestionRoot?.next_step,
    suggestionRoot?.nextStep,
    suggestionRoot?.plan,
    suggestionRoot?.summary,
    firstSuggestion?.plan,
    firstSuggestion?.summary,
    firstSuggestion?.text,
    suggestionRoot?.text,
    payload?.text,
  ]);

  const tips = pickList([
    { value: suggestionRoot?.tips, options: { titleKey: 'title', bodyKey: 'message' } },
    { value: suggestionRoot?.recommendations, options: { titleKey: 'title', bodyKey: 'message' } },
    { value: suggestionRoot?.steps, options: { titleKey: 'title', bodyKey: 'description' } },
    { value: suggestionRoot?.actions, options: { titleKey: 'label', bodyKey: 'detail' } },
    { value: suggestionRoot?.tips ?? suggestionRoot?.recommendations ?? [] },
  ]);

  const objections = pickList([
    { value: suggestionRoot?.objections, options: { titleKey: 'label', bodyKey: 'reply' } },
    { value: suggestionRoot?.objection_handling, options: { titleKey: 'label', bodyKey: 'reply' } },
    { value: suggestionRoot?.risks, options: { titleKey: 'title', bodyKey: 'mitigation' } },
    { value: suggestionRoot?.concerns },
  ]);

  const confidence = normalizeConfidence(
    payload?.confidence ?? payload?.confidence_score ?? suggestionRoot?.confidence ?? null
  );

  const supplemental = Array.isArray(suggestionRoot?.suggestions)
    ? suggestionRoot.suggestions.slice(1).flatMap((item) => {
        const entries = [];
        const textLine = coerceString(item?.text);
        if (textLine) {
          entries.push(textLine);
        }
        const rationaleLine = coerceString(item?.rationale);
        if (rationaleLine) {
          entries.push(`Racional: ${rationaleLine}`);
        }
        return entries;
      })
    : [];

  const combinedTips = tips.length > 0 ? tips : supplemental;

  const fallbackNotes =
    !nextStep && combinedTips.length === 0 && objections.length === 0
      ? [
          coerceString(suggestionRoot?.text),
          coerceString(suggestionRoot?.summary),
          coerceString(firstSuggestion?.text),
          coerceString(firstSuggestion?.rationale),
          Array.isArray(suggestionRoot?.suggestions)
            ? suggestionRoot.suggestions.map((item) => coerceString(item?.text)).filter(Boolean).join('\n')
            : null,
        ]
          .filter((item) => typeof item === 'string' && item.length > 0)
          .flatMap((item) => item.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean))
      : [];

  return {
    nextStep,
    tips: combinedTips.length > 0 ? combinedTips : fallbackNotes,
    objections,
    confidence,
    raw: rawPayload,
  };
};

export const formatAiSuggestionNote = (suggestion) => {
  if (!suggestion) {
    return null;
  }

  const { nextStep, tips = [], objections = [], confidence } = suggestion;
  const lines = ['🤖 Plano sugerido pela IA'];

  if (nextStep) {
    lines.push(`Próximo passo: ${nextStep}`);
  }

  if (Array.isArray(tips) && tips.length > 0) {
    lines.push('Dicas recomendadas:');
    for (const tip of tips) {
      lines.push(`• ${tip}`);
    }
  }

  if (Array.isArray(objections) && objections.length > 0) {
    lines.push('Objeções previstas:');
    for (const objection of objections) {
      lines.push(`• ${objection}`);
    }
  }

  if (typeof confidence === 'number') {
    lines.push(`Confiança da IA: ${confidence}%`);
  }

  return lines.join('\n');
};

export default extractAiSuggestion;
