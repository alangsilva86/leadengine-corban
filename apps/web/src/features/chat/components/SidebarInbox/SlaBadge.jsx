import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';

const SLA_RULES = [
  {
    predicate: ({ isOpen }) => !isOpen,
    resolve: () => ({
      label: 'Janela expirada',
      badgeProps: {
        tone: 'error',
      },
    }),
  },
  {
    predicate: ({ remainingMinutes }) => remainingMinutes === null || remainingMinutes === undefined,
    resolve: () => ({
      label: 'Janela indeterminada',
      badgeProps: {
        tone: 'info',
      },
    }),
  },
  {
    predicate: ({ remainingMinutes }) => remainingMinutes <= 15,
    resolve: ({ remainingMinutes }) => ({
      label: `Expira em ${remainingMinutes} min`,
      badgeProps: {
        tone: 'error',
      },
    }),
  },
  {
    predicate: ({ remainingMinutes }) => remainingMinutes <= 60,
    resolve: ({ remainingMinutes }) => ({
      label: `Expira em ${remainingMinutes} min`,
      badgeProps: {
        tone: 'warning',
      },
    }),
  },
  {
    predicate: () => true,
    resolve: ({ remainingMinutes }) => {
      const hours = Math.round(remainingMinutes / 60);
      return {
        label: `Expira em ${hours}h`,
        badgeProps: {
          tone: 'info',
        },
      };
    },
  },
];

export const resolveSlaDescriptor = (window = {}) => {
  const context = {
    isOpen: window.isOpen,
    remainingMinutes: window.remainingMinutes,
  };

  for (const rule of SLA_RULES) {
    if (rule.predicate(context)) {
      return rule.resolve(context);
    }
  }

  return null;
};

const BASE_BADGE_PROPS = {
  variant: 'status',
  tone: 'neutral',
  className: 'border border-border bg-transparent',
};

export const SlaBadge = ({ window }) => {
  const descriptor = useMemo(() => resolveSlaDescriptor(window ?? {}), [window]);

  if (!descriptor) {
    return null;
  }

  const { label, badgeProps = {} } = descriptor;
  const resolvedBadgeProps = {
    ...BASE_BADGE_PROPS,
    ...badgeProps,
    className: cn(BASE_BADGE_PROPS.className, badgeProps.className),
  };

  return (
    <Badge {...resolvedBadgeProps}>
      {label}
    </Badge>
  );
};

export default SlaBadge;
