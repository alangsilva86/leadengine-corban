import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils.js';

const clampWidth = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(Math.max(Math.round(value), min), max);
};

const SplitLayout = ({
  list,
  detail,
  listPosition = 'left',
  className,
  listClassName,
  detailClassName,
  minListWidth = 320,
  maxListWidthPx = 560,
  maxListWidthToken = '34vw',
  listWidth,
  isListVisible = true,
  onListWidthChange,
  onListWidthCommit,
  resizable = true,
  ...props
}) => {
  const numericWidth = useMemo(() => clampWidth(Number(listWidth), minListWidth, maxListWidthPx), [
    listWidth,
    minListWidth,
    maxListWidthPx,
  ]);

  const fallbackWidth = useMemo(
    () => `min(${maxListWidthToken}, ${maxListWidthPx}px)`,
    [maxListWidthToken, maxListWidthPx]
  );

  const resolvedWidth = numericWidth ?? minListWidth;
  const listColumnWidth = numericWidth ? `${numericWidth}px` : fallbackWidth;
  const shouldFixWidth = !resizable || !onListWidthChange;
  const listColumnDefinition = shouldFixWidth ? `${resolvedWidth}px` : `minmax(${minListWidth}px, ${listColumnWidth})`;

  const gridTemplateColumns = isListVisible
    ? listPosition === 'left'
      ? `${listColumnDefinition} minmax(0, 1fr)`
      : `minmax(0, 1fr) ${listColumnDefinition}`
    : '1fr';

  const gridTemplateAreas = isListVisible
    ? listPosition === 'left'
      ? '"list detail"'
      : '"detail list"'
    : '"detail"';

  const [isDragging, setIsDragging] = useState(false);
  const dragCleanupRef = useRef(null);
  const lastWidthRef = useRef(numericWidth ?? minListWidth);

  useEffect(() => {
    lastWidthRef.current = numericWidth ?? minListWidth;
  }, [numericWidth, minListWidth]);

  useEffect(() => {
    return () => {
      if (typeof dragCleanupRef.current === 'function') {
        dragCleanupRef.current();
      }
    };
  }, []);

  const teardownDragListeners = () => {
    if (typeof dragCleanupRef.current === 'function') {
      dragCleanupRef.current();
    }
  };

  const beginDrag = (event) => {
    if (!isListVisible || !onListWidthChange || typeof event?.clientX !== 'number') {
      return;
    }

    event.preventDefault();

    const startX = event.clientX;
    const startingWidth = lastWidthRef.current ?? numericWidth ?? minListWidth;

    const handleMove = (moveEvent) => {
      if (typeof moveEvent?.clientX !== 'number') {
        return;
      }

      const delta = listPosition === 'left' ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      const nextWidth = clampWidth(startingWidth + delta, minListWidth, maxListWidthPx);

      if (typeof nextWidth === 'number' && nextWidth !== lastWidthRef.current) {
        lastWidthRef.current = nextWidth;
        onListWidthChange(nextWidth);
      }
    };

    const finish = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      dragCleanupRef.current = null;
      const latestWidth = lastWidthRef.current;
      if (typeof latestWidth === 'number') {
        onListWidthCommit?.(latestWidth);
      }
    };

    teardownDragListeners();

    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);

    dragCleanupRef.current = finish;
    setIsDragging(true);
  };

  const handleResizerPointerDown = (event) => {
    beginDrag(event);
  };

  const handleResizerKeyDown = (event) => {
    if (!isListVisible || !onListWidthChange) {
      return;
    }

    const currentWidth = lastWidthRef.current ?? numericWidth ?? minListWidth;
    const step = event.shiftKey ? 32 : 16;
    let nextWidth = currentWidth;

    if (event.key === 'ArrowLeft') {
      nextWidth = clampWidth(currentWidth + (listPosition === 'left' ? -step : step), minListWidth, maxListWidthPx);
    } else if (event.key === 'ArrowRight') {
      nextWidth = clampWidth(currentWidth + (listPosition === 'left' ? step : -step), minListWidth, maxListWidthPx);
    } else if (event.key === 'Home') {
      nextWidth = minListWidth;
    } else if (event.key === 'End') {
      nextWidth = maxListWidthPx;
    } else {
      return;
    }

    if (typeof nextWidth === 'number' && nextWidth !== currentWidth) {
      event.preventDefault();
      lastWidthRef.current = nextWidth;
      onListWidthChange(nextWidth);
      onListWidthCommit?.(nextWidth);
    }
  };

  return (
    <div
      className={cn('relative grid h-full min-h-0 w-full gap-0 items-stretch', className)}
      style={{ gridTemplateColumns, gridTemplateAreas, gridTemplateRows: '1fr' }}
      data-list-position={listPosition}
      {...props}
    >
      {isListVisible ? (
        <aside
          aria-label="Lista de tickets"
          className={cn('relative flex h-full min-h-0 min-w-0 flex-col', listClassName)}
          style={{ gridArea: 'list' }}
        >
          {list}
        </aside>
      ) : null}
      <section
        className={cn('relative flex h-full min-h-0 min-w-0 flex-col', detailClassName)}
        style={{ gridArea: 'detail' }}
      >
        {detail}
      </section>
      {isListVisible && resizable && onListWidthChange ? (
        <div
          role="separator"
          aria-label="Ajustar largura da lista"
          aria-orientation="vertical"
          aria-valuemin={minListWidth}
          aria-valuemax={maxListWidthPx}
          aria-valuenow={numericWidth ?? minListWidth}
          tabIndex={0}
          onPointerDown={handleResizerPointerDown}
          onKeyDown={handleResizerKeyDown}
          className={cn(
            'absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--ring-shell)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]',
            listPosition === 'left' ? '-right-1 translate-x-1/2' : '-left-1 -translate-x-1/2',
            isDragging
              ? 'bg-[color:color-mix(in_srgb,var(--border-shell)_55%,transparent)]'
              : 'bg-transparent'
          )}
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-[30%] left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-[color:color-mix(in_srgb,var(--border-shell)_75%,transparent)]"
          />
        </div>
      ) : null}
    </div>
  );
};

export default SplitLayout;
