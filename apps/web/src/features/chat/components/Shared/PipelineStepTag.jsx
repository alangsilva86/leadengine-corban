import { Badge } from '@/components/ui/badge.jsx';

export const PipelineStepTag = ({ step }) => {
  if (!step) {
    return null;
  }
  const label = step.charAt(0).toUpperCase() + step.slice(1);
  return (
    <Badge variant="outline" className="border border-slate-700 bg-transparent text-slate-300">
      {label}
    </Badge>
  );
};

export default PipelineStepTag;
