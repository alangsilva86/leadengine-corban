import { Fragment, useMemo } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import StageColumn from './StageColumn';
import type { LeadSummary } from '../../state/leads';
import { useCrmViewContext } from '../../state/view-context';
import emitCrmTelemetry from '../../utils/telemetry';

 type KanbanBoardProps = {
  stages: Array<{ id: string; title: string }>;
  leadsByStage: Record<string, LeadSummary[]>;
  metricsByStage?: Record<string, { totalPotential?: number; stalledCount?: number } | null>;
  isLoading?: boolean;
  onMoveLead?: (leadId: string, fromStage: string, toStage: string, position: number) => Promise<void> | void;
};

const KanbanBoard = ({ stages, leadsByStage, metricsByStage, isLoading = false, onMoveLead }: KanbanBoardProps) => {
  const { clearSelection } = useCrmViewContext();

  const totalLeads = useMemo(
    () => stages.reduce((sum, stage) => sum + (leadsByStage[stage.id]?.length ?? 0), 0),
    [stages, leadsByStage]
  );

  const handleDragEnd = async (result: DropResult) => {
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
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 text-sm text-muted-foreground">
        Carregando leads…
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <ScrollArea className="h-full">
        <div
          className="flex min-h-[420px] gap-4"
          onClick={() => {
            clearSelection();
          }}
          role="list"
        >
          {stages.map((stage) => (
            <Fragment key={stage.id}>
              <StageColumn
                stageId={stage.id}
                title={stage.title}
                leads={leadsByStage[stage.id] ?? []}
                metrics={metricsByStage?.[stage.id] ?? null}
              />
            </Fragment>
          ))}
        </div>
      </ScrollArea>
    </DragDropContext>
  );
};

export default KanbanBoard;
