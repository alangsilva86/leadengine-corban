import type { LeadSummary } from '../../state/leads';
type KanbanBoardProps = {
    stages: Array<{
        id: string;
        title: string;
    }>;
    leadsByStage: Record<string, LeadSummary[]>;
    metricsByStage?: Record<string, {
        totalPotential?: number;
        stalledCount?: number;
    } | null>;
    isLoading?: boolean;
    onMoveLead?: (leadId: string, fromStage: string, toStage: string, position: number) => Promise<void> | void;
};
declare const KanbanBoard: ({ stages, leadsByStage, metricsByStage, isLoading, onMoveLead }: KanbanBoardProps) => import("react/jsx-runtime").JSX.Element;
export default KanbanBoard;
