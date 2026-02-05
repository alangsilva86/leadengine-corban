import type { LeadTimelineEvent } from '../../state/leads';
type LeadTimelineProps = {
    events: LeadTimelineEvent[];
};
declare const LeadTimeline: ({ events }: LeadTimelineProps) => import("react/jsx-runtime").JSX.Element;
export default LeadTimeline;
