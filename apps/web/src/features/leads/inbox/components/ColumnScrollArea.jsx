import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { cn } from '@/lib/utils.js';

const ColumnScrollArea = forwardRef(({ className, viewportClassName, children, ...props }, forwardedRef) => {
  const viewportRef = useRef(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const scrollActivityTimeout = useRef(null);

  const updateShadows = useCallback(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = node;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const topVisible = scrollTop > 2;
    const bottomVisible = scrollTop < maxScroll - 2;

    setShowTopShadow(topVisible);
    setShowBottomShadow(bottomVisible);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const node = viewportRef.current;
    if (!node) {
      return undefined;
    }

    const handleScroll = () => {
      updateShadows();
      setIsInteracting(true);
      window.clearTimeout(scrollActivityTimeout.current);
      scrollActivityTimeout.current = window.setTimeout(() => setIsInteracting(false), 350);
    };

    const handleResize = () => {
      window.clearTimeout(scrollActivityTimeout.current);
      updateShadows();
    };

    updateShadows();

    node.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      node.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      window.clearTimeout(scrollActivityTimeout.current);
    };
  }, [updateShadows]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const frame = window.requestAnimationFrame(updateShadows);
    return () => window.cancelAnimationFrame(frame);
  }, [children, updateShadows]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      scrollTo: (options) => viewportRef.current?.scrollTo(options),
      get node() {
        return viewportRef.current;
      },
    }),
    []
  );

  return (
    <div className={cn('group relative h-full min-h-0 overflow-hidden', className)}>
      <div
        ref={viewportRef}
        data-scrolling={isInteracting ? 'true' : undefined}
        className={cn(
          'column-scroll-viewport h-full overflow-y-auto overscroll-contain scroll-smooth',
          viewportClassName
        )}
        style={{ WebkitOverflowScrolling: 'touch', contain: 'content' }}
        {...props}
      >
        {children}
      </div>

      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-slate-950/85 via-slate-950/35 to-transparent transition-opacity duration-200 ease-out',
          showTopShadow ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent transition-opacity duration-200 ease-out',
          showBottomShadow ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
});

ColumnScrollArea.displayName = 'ColumnScrollArea';

export default ColumnScrollArea;
