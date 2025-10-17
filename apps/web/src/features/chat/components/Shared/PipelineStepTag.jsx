import { Badge } from '@/components/ui/badge.jsx';

export const PipelineStepTag = ({ step }) => {
  if (!step) {
    return null;
  }
  const label = step.charAt(0).toUpperCase() + step.slice(1);
  return (
    <Badge variant="outline" className="border border-border bg-transparent text-foreground-muted">
      {label}
    </Badge>
  );
};

export default PipelineStepTag;
