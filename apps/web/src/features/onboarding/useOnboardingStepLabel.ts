import { useMemo } from 'react';

export type OnboardingStage = {
  id: string;
  label: string;
};

export type OnboardingFallbackStep = {
  number: number;
  label: string;
  nextStage: string;
};

export type UseOnboardingStepLabelParams = {
  stages: OnboardingStage[] | null | undefined;
  targetStageId: string | null | undefined;
  fallbackStep: OnboardingFallbackStep;
};

export type UseOnboardingStepLabelResult = {
  stepLabel: string;
  nextStage: string;
};

const useOnboardingStepLabel = ({
  stages,
  targetStageId,
  fallbackStep,
}: UseOnboardingStepLabelParams): UseOnboardingStepLabelResult =>
  useMemo(() => {
    if (!stages || stages.length === 0) {
      return {
        stepLabel: fallbackStep.label,
        nextStage: fallbackStep.nextStage,
      };
    }

    const totalStages = stages.length;
    const targetIndex = targetStageId
      ? stages.findIndex((stage) => stage.id === targetStageId)
      : -1;

    if (targetIndex >= 0) {
      const nextStageLabel = stages[targetIndex + 1]?.label ?? fallbackStep.nextStage;

      return {
        stepLabel: `Passo ${targetIndex + 1} de ${totalStages}`,
        nextStage: nextStageLabel,
      };
    }

    const fallbackNextStage = stages[0]?.label ?? fallbackStep.nextStage;

    return {
      stepLabel: `${fallbackStep.label} de ${totalStages}`,
      nextStage: fallbackNextStage,
    };
  }, [fallbackStep.label, fallbackStep.nextStage, stages, targetStageId]);

export default useOnboardingStepLabel;
