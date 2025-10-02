import { cloneElement } from 'react';
import { cn } from '@/lib/utils.js';

export const ButtonGroup = ({ children, className, layout = 'row' }) => {
  const items = Array.isArray(children) ? children : [children];
  const orientationClass = layout === 'column' ? 'flex-col' : 'flex-row';

  return (
    <div className={cn('inline-flex flex-wrap items-center gap-3', orientationClass, className)}>
      {items.map((child, index) =>
        child && typeof child === 'object'
          ? cloneElement(child, {
              key: child.key ?? index,
            })
          : child
      )}
    </div>
  );
};

export default ButtonGroup;
