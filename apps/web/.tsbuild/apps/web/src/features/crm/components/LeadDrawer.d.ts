type LeadDrawerProps = {
    open: boolean;
    leadId: string | null;
    onOpenChange: (nextOpen: boolean) => void;
};
declare const LeadDrawer: ({ open, leadId, onOpenChange }: LeadDrawerProps) => import("react/jsx-runtime").JSX.Element;
export default LeadDrawer;
