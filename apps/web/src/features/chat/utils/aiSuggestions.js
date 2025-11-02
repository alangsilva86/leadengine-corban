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

const toList = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => coerceString(item))
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

  const nextStep =
    coerceString(payload?.next_step) ??
    coerceString(payload?.nextStep) ??
    coerceString(payload?.plan) ??
    null;

  const tips = toList(payload?.tips ?? payload?.recommendations ?? []);
  const objections = toList(payload?.objections ?? payload?.objection_handling ?? []);
  const confidence = normalizeConfidence(payload?.confidence ?? payload?.confidence_score ?? null);

  return {
    nextStep,
    tips,
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
