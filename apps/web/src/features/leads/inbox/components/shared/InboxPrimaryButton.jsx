import { forwardRef } from 'react';

import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';

const InboxPrimaryButton = forwardRef(({ className, uppercase = false, ...props }, ref) => (
  <Button
    ref={ref}
    className={cn(
      'bgAccentInboxPrimary textAccentInboxPrimaryForeground shadow-[0_12px_34px_color-mix(in_srgb,var(--accent-inbox-primary)_40%,transparent)] transition-colors hover:bg-[color-mix(in_oklab,var(--accent-inbox-primary)_85%,white)] dark:hover:bg-[color-mix(in_oklab,var(--accent-inbox-primary)_80%,black)]',
      uppercase && 'uppercase tracking-[0.24em]',
      className,
    )}
    {...props}
  />
));

InboxPrimaryButton.displayName = 'InboxPrimaryButton';

export { InboxPrimaryButton };
