import type { LeadSummary } from '../../state/leads';
type StageColumnProps = {
    stageId: string;
    title: string;
    leads: LeadSummary[];
    metrics?: {
        totalPotential?: number;
        stalledCount?: number;
    } | null;
};
declare const StageColumn: import("react").MemoExoticComponent<({ stageId, title, leads, metrics }: StageColumnProps) => import("react/jsx-runtime").JSX.Element>;
export default StageColumn;
