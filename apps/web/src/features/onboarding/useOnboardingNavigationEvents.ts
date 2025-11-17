import { useEffect } from 'react';

export type UseOnboardingNavigationEventsOptions = {
  onNavigate: (targetPage: string) => void;
};

export function useOnboardingNavigationEvents({ onNavigate }: UseOnboardingNavigationEventsOptions) {
  useEffect(() => {
    const handleExternalNavigation = (event: Event) => {
      const { detail } = event as CustomEvent<string>;
      if (typeof detail !== 'string' || detail.length === 0) {
        return;
      }

      onNavigate(detail);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('leadengine:navigate', handleExternalNavigation);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('leadengine:navigate', handleExternalNavigation);
      }
    };
  }, [onNavigate]);
}

export default useOnboardingNavigationEvents;
