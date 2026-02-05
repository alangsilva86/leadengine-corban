type LeadActionListProps = {
    onMarkConnected?: () => void;
    onScheduleFollowUp?: () => void;
    onSendMessage?: () => void;
    onEditLead?: () => void;
    busy?: boolean;
    canManageTasks?: boolean;
    canEditLead?: boolean;
};
declare const LeadActionList: ({ onMarkConnected, onScheduleFollowUp, onSendMessage, onEditLead, busy, canManageTasks, canEditLead, }: LeadActionListProps) => import("react/jsx-runtime").JSX.Element;
export default LeadActionList;
