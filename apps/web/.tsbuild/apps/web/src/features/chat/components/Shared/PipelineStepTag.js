import { jsx as _jsx } from "react/jsx-runtime";
import { Badge } from '@/components/ui/badge.jsx';
export const PipelineStepTag = ({ step }) => {
    if (!step) {
        return null;
    }
    const label = step.charAt(0).toUpperCase() + step.slice(1);
    return (_jsx(Badge, { variant: "outline", className: "border border-border bg-transparent text-foreground-muted", children: label }));
};
export default PipelineStepTag;
