import { useMemo } from 'react';

export type StageDefinition = {
  id: string;
  label: string;
};

export type FallbackStepDefinition = {
  number: number;
  label: string;
  nextStage: string;
};

export type UseStepLabelParams = {
  stages: StageDefinition[] | null | undefined;
  targetStageId: string | null | undefined;
  fallbackStep: FallbackStepDefinition;
};

export type UseStepLabelResult = {
  stepLabel: string;
  nextStage: string;
};

const useStepLabel = ({ stages, targetStageId, fallbackStep }: UseStepLabelParams): UseStepLabelResult =>
  useMemo(() => {
    if (!stages || stages.length === 0) {
      return {
        stepLabel: fallbackStep.label,
        nextStage: fallbackStep.nextStage,
      };
    }

    const totalStages = stages.length;
    const targetIndex = targetStageId ? stages.findIndex((stage) => stage.id === targetStageId) : -1;

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

export default useStepLabel;

