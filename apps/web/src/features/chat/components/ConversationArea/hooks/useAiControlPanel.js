import { useCallback, useMemo } from 'react';

const AI_MODE_OPTIONS = [
  { value: 'assist', label: 'IA assistida' },
  { value: 'auto', label: 'IA autônoma' },
  { value: 'manual', label: 'Agente no comando' },
];

const DEFAULT_AI_MODE = AI_MODE_OPTIONS[0].value;
const AI_HANDOFF_CONFIDENCE_THRESHOLD = 0.5;

const AI_CONFIDENCE_TONES = {
  high: 'border-success-soft-border bg-success-soft text-success-strong',
  medium: 'border-warning-soft-border bg-warning-soft text-warning-strong',
  low: 'border-status-error-border bg-status-error-surface text-status-error-foreground',
  unknown: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
};

const normalizeAiModeValue = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'autonomous') {
    return 'auto';
  }

  return normalized;
};

const isValidAiMode = (value) => AI_MODE_OPTIONS.some((option) => option.value === value);

const useAiControlPanel = ({
  ticket,
  aiMode,
  aiConfidence,
  onAiModeChange,
  onTakeOver,
  onGiveBackToAi,
  aiModeChangeDisabled = false,
}) => {
  const normalizedAiModeCandidate = normalizeAiModeValue(aiMode);
  const normalizedAiMode = isValidAiMode(normalizedAiModeCandidate)
    ? normalizedAiModeCandidate
    : DEFAULT_AI_MODE;

  const normalizedConfidence = useMemo(() => {
    if (typeof aiConfidence !== 'number' || Number.isNaN(aiConfidence)) {
      return null;
    }

    if (aiConfidence > 1) {
      const ratio = aiConfidence / 100;
      return Math.max(0, Math.min(1, ratio));
    }

    if (aiConfidence < 0) {
      return 0;
    }

    return Math.max(0, Math.min(1, aiConfidence));
  }, [aiConfidence]);

  const aiConfidencePercent = useMemo(
    () => (normalizedConfidence !== null ? Math.round(normalizedConfidence * 100) : null),
    [normalizedConfidence],
  );

  const aiConfidenceTone = normalizedConfidence === null
    ? 'unknown'
    : normalizedConfidence >= 0.75
      ? 'high'
      : normalizedConfidence >= AI_HANDOFF_CONFIDENCE_THRESHOLD
        ? 'medium'
        : 'low';

  const aiConfidenceToneClass = AI_CONFIDENCE_TONES[aiConfidenceTone] ?? AI_CONFIDENCE_TONES.unknown;
  const aiConfidenceLabel =
    aiConfidencePercent !== null ? `${aiConfidencePercent}% confiança` : 'Confiança indisponível';

  const aiModeSelectDisabled = !ticket || !onAiModeChange || aiModeChangeDisabled;

  const handleAiModeSelect = useCallback(
    (value) => {
      const normalizedValue = normalizeAiModeValue(value);

      if (!onAiModeChange || aiModeChangeDisabled || !isValidAiMode(normalizedValue)) {
        return;
      }

      onAiModeChange(normalizedValue);
    },
    [aiModeChangeDisabled, onAiModeChange],
  );

  const handleTakeOverClick = useCallback(() => {
    onTakeOver?.();
  }, [onTakeOver]);

  const handleGiveBackClick = useCallback(() => {
    onGiveBackToAi?.();
  }, [onGiveBackToAi]);

  const takeoverDisabled = useMemo(
    () => !ticket || !onTakeOver || aiModeChangeDisabled || normalizedAiMode === 'manual',
    [aiModeChangeDisabled, normalizedAiMode, onTakeOver, ticket],
  );

  const giveBackDisabled = useMemo(
    () =>
      !ticket ||
      !onGiveBackToAi ||
      aiModeChangeDisabled ||
      normalizedAiMode === 'auto' ||
      normalizedConfidence === null ||
      normalizedConfidence < AI_HANDOFF_CONFIDENCE_THRESHOLD,
    [aiModeChangeDisabled, normalizedAiMode, normalizedConfidence, onGiveBackToAi, ticket],
  );

  const takeoverTooltipMessage = useMemo(() => {
    if (!ticket) return 'Nenhum ticket selecionado';
    if (!onTakeOver) return 'Ação indisponível';
    if (aiModeChangeDisabled) return 'Aguardando estado da IA';
    if (normalizedAiMode === 'manual') return 'Agente já está no comando';
    return 'Assumir atendimento manualmente';
  }, [aiModeChangeDisabled, normalizedAiMode, onTakeOver, ticket]);

  const giveBackTooltipMessage = useMemo(() => {
    if (!ticket) return 'Nenhum ticket selecionado';
    if (!onGiveBackToAi) return 'Ação indisponível';
    if (aiModeChangeDisabled) return 'Aguardando estado da IA';
    if (normalizedAiMode === 'auto') return 'IA já está no comando';
    if (normalizedConfidence === null) return 'Confiança da IA indisponível';
    if (normalizedConfidence < AI_HANDOFF_CONFIDENCE_THRESHOLD) {
      return 'Confiança insuficiente para devolver à IA';
    }
    return 'Devolver atendimento para a IA';
  }, [aiModeChangeDisabled, normalizedAiMode, normalizedConfidence, onGiveBackToAi, ticket]);

  return {
    aiModeOptions: AI_MODE_OPTIONS,
    normalizedAiMode,
    aiModeSelectDisabled,
    handleAiModeSelect,
    aiConfidenceLabel,
    aiConfidenceToneClass,
    handleTakeOverClick,
    handleGiveBackClick,
    takeoverDisabled,
    giveBackDisabled,
    takeoverTooltipMessage,
    giveBackTooltipMessage,
  };
};

export {
  AI_MODE_OPTIONS,
  DEFAULT_AI_MODE,
  AI_HANDOFF_CONFIDENCE_THRESHOLD,
  AI_CONFIDENCE_TONES,
  isValidAiMode,
};

export default useAiControlPanel;
