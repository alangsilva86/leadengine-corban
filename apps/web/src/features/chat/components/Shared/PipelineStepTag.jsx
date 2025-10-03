import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';

const palette = [
  'bg-purple-500/15 text-purple-200 border-purple-400/40',
  'bg-rose-500/15 text-rose-200 border-rose-400/40',
  'bg-sky-500/15 text-sky-200 border-sky-400/40',
  'bg-emerald-500/15 text-emerald-200 border-emerald-400/40',
  'bg-orange-500/15 text-orange-200 border-orange-400/40',
];

const hash = (value) => {
  const input = `${value || ''}`;
  let acc = 0;
  for (let i = 0; i < input.length; i += 1) {
    acc = (acc * 31 + input.charCodeAt(i)) % palette.length;
  }
  return acc;
};

export const PipelineStepTag = ({ step }) => {
  if (!step) {
    return null;
  }
  const index = hash(step);
  const label = step.charAt(0).toUpperCase() + step.slice(1);
  return (
    <Badge variant="outline" className={cn('border', palette[index])}>
      {label}
    </Badge>
  );
};

export default PipelineStepTag;
