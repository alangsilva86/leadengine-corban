import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge.jsx';

const getTone = ({ remainingMinutes, isOpen }) => {
  if (!isOpen) {
    return {
      label: 'Janela expirada',
    };
  }

  if (remainingMinutes === null || remainingMinutes === undefined) {
    return {
      label: 'Janela indeterminada',
    };
  }

  if (remainingMinutes <= 15) {
    return {
      label: `Expira em ${remainingMinutes} min`,
    };
  }

  if (remainingMinutes <= 60) {
    return {
      label: `Expira em ${remainingMinutes} min`,
    };
  }

  const hours = Math.round(remainingMinutes / 60);
  return {
    label: `Expira em ${hours}h`,
  };
};

export const SlaBadge = ({ window }) => {
  const tone = useMemo(() => getTone(window ?? {}), [window]);

  return (
    <Badge variant="outline" className="border border-slate-700 bg-transparent text-slate-300">
      {tone.label}
    </Badge>
  );
};

export default SlaBadge;
