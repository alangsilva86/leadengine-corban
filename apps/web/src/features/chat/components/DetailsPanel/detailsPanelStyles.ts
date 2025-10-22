import { cva } from 'class-variance-authority';

export const detailsPanelContainer = cva(
  'flex w-full flex-1 min-w-0 flex-col gap-5 overflow-y-auto overflow-x-hidden p-4'
);

export const sectionGroup = cva('w-full min-w-0 space-y-3');

export const sectionItem = cva(
  'w-full min-w-0 overflow-hidden rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/40 px-2 backdrop-blur'
);

export const sectionTrigger = cva(
  'hover:no-underline focus-visible:ring-ring/50 flex w-full flex-1 flex-wrap items-start justify-between gap-4 rounded-xl px-3 py-4 text-left text-sm font-semibold text-foreground'
);

export const sectionContent = cva('px-0');

export const sectionContentInner = cva(
  'min-w-0 max-w-full overflow-hidden rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/80 p-4 text-sm text-foreground'
);

export const panelHeaderSection = cva(
  'w-full rounded-3xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/60 p-5 shadow-[0_24px_45px_-32px_rgba(15,23,42,0.8)] backdrop-blur'
);

export const panelHeaderLayout = cva(
  'flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'
);

export const tabsList = cva(
  'flex w-full min-w-0 flex-wrap items-center justify-start gap-2 overflow-x-auto bg-surface-overlay-quiet/60 p-1.5 md:flex-nowrap'
);

export const tabsContent = cva('min-w-0 space-y-4');
