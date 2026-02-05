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
declare const useStepLabel: ({ stages, targetStageId, fallbackStep }: UseStepLabelParams) => UseStepLabelResult;
export default useStepLabel;
