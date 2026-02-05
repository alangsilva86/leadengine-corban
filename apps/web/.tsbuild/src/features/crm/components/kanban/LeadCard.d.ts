import type { LeadSummary } from '../../state/leads';
type LeadCardProps = {
    lead: LeadSummary;
    index: number;
};
declare const LeadCard: import("react").MemoExoticComponent<({ lead, index }: LeadCardProps) => import("react/jsx-runtime").JSX.Element>;
export default LeadCard;
