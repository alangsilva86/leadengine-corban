import type { ReactNode } from 'react';

export type NoticeBannerTone = 'info' | 'warning' | 'success' | 'error' | 'neutral';

export interface NoticeBannerProps {
  tone?: NoticeBannerTone;
  variant?: NoticeBannerTone;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

declare const NoticeBanner: (props: NoticeBannerProps) => JSX.Element;
export default NoticeBanner;
export { NoticeBanner };
