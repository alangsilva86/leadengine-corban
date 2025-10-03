import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge.jsx';

const getTone = ({ remainingMinutes, isOpen }) => {
  if (!isOpen) {
    return {
      className: 'bg-rose-500/15 text-rose-200 border-rose-500/40',
      label: 'Janela expirada',
    };
  }

  if (remainingMinutes === null || remainingMinutes === undefined) {
    return {
      className: 'bg-slate-500/15 text-slate-200 border-slate-500/40',
      label: 'Janela indeterminada',
    };
  }

  if (remainingMinutes <= 15) {
    return {
      className: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
      label: `Expira em ${remainingMinutes} min`,
    };
  }

  if (remainingMinutes <= 60) {
    return {
      className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
      label: `Expira em ${remainingMinutes} min`,
    };
  }

  const hours = Math.round(remainingMinutes / 60);
  return {
    className: 'bg-sky-500/15 text-sky-200 border-sky-500/40',
    label: `Expira em ${hours}h`,
  };
};

export const SlaBadge = ({ window }) => {
  const tone = useMemo(() => getTone(window ?? {}), [window]);

  return (
    <Badge variant="outline" className={`border ${tone.className}`}>
      {tone.label}
    </Badge>
  );
};

export default SlaBadge;
