import type { LeadSummary } from '../../state/leads';
type LeadTableRowProps = {
    lead: LeadSummary;
    selected: boolean;
    onToggleSelect: (leadId: string) => void;
    onOpenDrawer: (leadId: string) => void;
    selectable?: boolean;
};
declare const LeadTableRow: import("react").MemoExoticComponent<({ lead, selected, onToggleSelect, onOpenDrawer, selectable }: LeadTableRowProps) => import("react/jsx-runtime").JSX.Element>;
export default LeadTableRow;
