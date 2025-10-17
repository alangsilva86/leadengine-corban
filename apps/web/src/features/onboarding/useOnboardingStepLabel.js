import { useMemo } from 'react';

const normalizeStages = (stages) => {
  if (!Array.isArray(stages)) {
    return [];
  }
  return stages.filter(Boolean);
};

const resolveFallback = (fallbackStep) => {
  if (typeof fallbackStep === 'number') {
    return {
      number: fallbackStep,
      label: `Passo ${fallbackStep}`,
      nextStage: null,
    };
  }

  if (typeof fallbackStep === 'string') {
    return {
      number: 1,
      label: fallbackStep,
      nextStage: null,
    };
  }

  if (fallbackStep && typeof fallbackStep === 'object') {
    const number = Number.isFinite(fallbackStep.number) ? fallbackStep.number : 1;
    const label = typeof fallbackStep.label === 'string' ? fallbackStep.label : `Passo ${number}`;
    const nextStage = typeof fallbackStep.nextStage === 'string' ? fallbackStep.nextStage : null;
    return { number, label, nextStage };
  }

  return {
    number: 1,
    label: 'Passo 1',
    nextStage: null,
  };
};

const resolveStageLabel = (stage) => {
  if (!stage || typeof stage !== 'object') {
    return null;
  }
  if (typeof stage.label === 'string' && stage.label.trim().length > 0) {
    return stage.label;
  }
  if (typeof stage.title === 'string' && stage.title.trim().length > 0) {
    return stage.title;
  }
  return null;
};

const computeStepState = (stages, targetStageId, fallbackStep) => {
  const normalizedStages = normalizeStages(stages);
  const fallback = resolveFallback(fallbackStep);
  const totalStages = normalizedStages.length;
  const stageIndex = normalizedStages.findIndex((stage) => stage?.id === targetStageId);
  const stepNumber = stageIndex >= 0 ? stageIndex + 1 : fallback.number;
  const clampedStepNumber = totalStages > 0 ? Math.min(stepNumber, totalStages) : stepNumber;
  const stepLabel = totalStages > 0
    ? `Passo ${clampedStepNumber} de ${totalStages}`
    : fallback.label;

  let nextStage = fallback.nextStage;
  if (totalStages > 0) {
    const nextIndex = Math.min(stageIndex + 1, totalStages - 1);
    if (nextIndex >= 0) {
      const candidate = resolveStageLabel(normalizedStages[nextIndex]);
      if (candidate) {
        nextStage = candidate;
      }
    }
  }

  return { stepLabel, nextStage };
};

const useOnboardingStepLabel = ({ stages, targetStageId, fallbackStep }) =>
  useMemo(
    () => computeStepState(stages, targetStageId, fallbackStep),
    [stages, targetStageId, fallbackStep]
  );

export default useOnboardingStepLabel;
