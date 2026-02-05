import type { LeadSummary } from '../../state/leads';
declare const LeadTable: import("react").ForwardRefExoticComponent<{
    leads: LeadSummary[];
    selectedIds: Set<string>;
    onToggleSelect: (leadId: string) => void;
    onOpenDrawer: (leadId: string) => void;
    fetchNextPage?: () => void;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    isLoading?: boolean;
    selectable?: boolean;
} & import("react").RefAttributes<HTMLDivElement>>;
export default LeadTable;
