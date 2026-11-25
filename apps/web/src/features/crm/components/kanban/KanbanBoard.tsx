import { useCallback, useMemo, useState } from 'react';
import { DragDropContext, type BeforeCapture, type DropResult } from '@hello-pangea/dnd';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import type { LeadSummary } from '../../state/leads';
import type { KanbanStage } from '../../hooks/useKanbanStages';
import {
  canTransitionLeadStage,
  getAllowedLeadStageTargets,
  normalizeLeadStage,
  parseLeadStage,
  type LeadStage,
} from '../../utils/lead-stage';
import ExitsColumn from './ExitsColumn';
import StageColumn, { type DropState } from './StageColumn';

type KanbanBoardProps = {
  stages: KanbanStage[];
  exits?: KanbanStage[];
  leadsByStage: Record<string, LeadSummary[]>;
  metricsByStage?: Record<string, { totalPotential?: number; stalledCount?: number } | null>;
  isLoading?: boolean;
  onOpenLead: (lead: LeadSummary) => void;
  /**
   * Persiste a mudança de etapa (arraste ou menu "Mover para…").
   * Sem esta prop o quadro fica só de leitura.
   */
  onMoveLead?: (lead: LeadSummary, toStage: LeadStage, source: 'kanban' | 'menu') => Promise<unknown> | void;
};

const DRAG_INSTRUCTIONS =
  'Para mover o lead, pressione espaço, use as setas para escolher a etapa e pressione espaço de novo para soltar. Esc cancela. Ou use o botão "Mover para".';

/** Motivo curto exibido sobre a coluna bloqueada durante o arraste. */
const SHORT_BLOCK_REASON: Partial<Record<LeadStage, string>> = {
  ganho: 'Lead ganho é final',
  perdido: 'Só pode ir para Reciclar',
};

const KanbanBoard = ({ stages, exits = [], leadsByStage, metricsByStage, isLoading = false, onOpenLead, onMoveLead }: KanbanBoardProps) => {
  const [dragFrom, setDragFrom] = useState<LeadStage | null>(null);
  const readOnly = !onMoveLead;

  const leadIndex = useMemo(() => {
    const index = new Map<string, LeadSummary>();
    Object.values(leadsByStage).forEach((list) => list.forEach((lead) => index.set(lead.id, lead)));
    return index;
  }, [leadsByStage]);

  // Lead ganho não muda mais de etapa: nem começa o arraste.
  const isLeadDragDisabled = useCallback(
    (lead: LeadSummary) => readOnly || getAllowedLeadStageTargets(lead.stage).length === 0,
    [readOnly]
  );

  const handleBeforeCapture = useCallback(
    ({ draggableId }: BeforeCapture) => {
      const lead = leadIndex.get(draggableId);
      setDragFrom(lead ? normalizeLeadStage(lead.stage) : null);
    },
    [leadIndex]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      setDragFrom(null);
      const { destination, draggableId } = result;
      if (!onMoveLead || !destination) return;
      const lead = leadIndex.get(draggableId);
      const target = parseLeadStage(destination.droppableId);
      if (!lead || !target || target === lead.stage) return;
      if (!canTransitionLeadStage(normalizeLeadStage(lead.stage), target)) return;
      void onMoveLead(lead, target, 'kanban');
    },
    [leadIndex, onMoveLead]
  );

  const handleRequestMove = useMemo(
    () => (onMoveLead ? (lead: LeadSummary, target: LeadStage) => void onMoveLead(lead, target, 'menu') : undefined),
    [onMoveLead]
  );

  const dropStates = useMemo(() => {
    const states: Record<string, DropState> = {};
    [...stages, ...exits].forEach((stage) => {
      if (!dragFrom) states[stage.id] = 'idle';
      else if (stage.id === dragFrom) states[stage.id] = 'source';
      else states[stage.id] = canTransitionLeadStage(dragFrom, stage.id) ? 'allowed' : 'blocked';
    });
    return states;
  }, [dragFrom, exits, stages]);

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Carregando funil">
        {stages.map((stage) => (
          <div key={stage.id} className="flex w-[264px] shrink-0 flex-col gap-2 rounded-lg bg-surface-sunken p-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onBeforeCapture={handleBeforeCapture} onDragEnd={handleDragEnd} dragHandleUsageInstructions={DRAG_INSTRUCTIONS}>
      <ScrollArea orientation="horizontal" className="-mx-1">
        <div className="flex items-start gap-3 px-1 pb-3" data-crm-board data-dragging={dragFrom ? 'true' : undefined}>
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              leads={leadsByStage[stage.id] ?? []}
              metrics={metricsByStage?.[stage.id] ?? null}
              dropState={dropStates[stage.id]}
              blockedReason={dragFrom ? SHORT_BLOCK_REASON[dragFrom] ?? null : null}
              isLeadDragDisabled={isLeadDragDisabled}
              onOpenLead={onOpenLead}
              onRequestMove={handleRequestMove}
            />
          ))}
          {exits.length ? (
            <ExitsColumn
              stages={exits}
              leadsByStage={leadsByStage}
              dropStates={dropStates}
              isLeadDragDisabled={isLeadDragDisabled}
              onOpenLead={onOpenLead}
              onRequestMove={handleRequestMove}
            />
          ) : null}
        </div>
      </ScrollArea>
    </DragDropContext>
  );
};

export default KanbanBoard;
