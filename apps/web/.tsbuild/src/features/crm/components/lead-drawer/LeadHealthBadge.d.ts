type LeadHealthBadgeProps = {
    status: 'healthy' | 'warning' | 'critical' | undefined | null;
};
declare const LeadHealthBadge: ({ status }: LeadHealthBadgeProps) => import("react/jsx-runtime").JSX.Element;
export default LeadHealthBadge;
