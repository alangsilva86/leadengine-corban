import { jsx as _jsx } from "react/jsx-runtime";
import { Fragment, useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import StageColumn from './StageColumn';
import { useCrmViewContext } from '../../state/view-context';
import emitCrmTelemetry from '../../utils/telemetry';
const KanbanBoard = ({ stages, leadsByStage, metricsByStage, isLoading = false, onMoveLead }) => {
    const { clearSelection } = useCrmViewContext();
    const totalLeads = useMemo(() => stages.reduce((sum, stage) => sum + (leadsByStage[stage.id]?.length ?? 0), 0), [stages, leadsByStage]);
    const handleDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination || destination.droppableId === source.droppableId) {
            return;
        }
        if (!onMoveLead) {
            return;
        }
        emitCrmTelemetry('crm.lead.move', {
            leadId: draggableId,
            fromStage: source.droppableId,
            toStage: destination.droppableId,
            position: destination.index,
            source: 'kanban',
        });
        await onMoveLead(draggableId, source.droppableId, destination.droppableId, destination.index);
    };
    if (isLoading && totalLeads === 0) {
        return (_jsx("div", { className: "flex h-[420px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 text-sm text-muted-foreground", children: "Carregando leads\u2026" }));
    }
    return (_jsx(DragDropContext, { onDragEnd: handleDragEnd, children: _jsx(ScrollArea, { className: "h-full", children: _jsx("div", { className: "flex min-h-[420px] gap-4", onClick: () => {
                    clearSelection();
                }, role: "list", children: stages.map((stage) => (_jsx(Fragment, { children: _jsx(StageColumn, { stageId: stage.id, title: stage.title, leads: leadsByStage[stage.id] ?? [], metrics: metricsByStage?.[stage.id] ?? null }) }, stage.id))) }) }) }));
};
export default KanbanBoard;
