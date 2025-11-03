import { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query.js';
import emitInboxTelemetry from '../../../utils/telemetry.js';
import {
  CONTEXT_PREFERENCE_KEY,
  readPreference,
  writePreference,
} from '../preferences.ts';

const useInboxLayoutState = ({
  defaultContextOpen = false,
  contextAvailable = false,
  currentUser,
  telemetry = emitInboxTelemetry,
} = {}) => {
  const canPersistPreferences = Boolean(currentUser?.id);
  const [contextOpen, setContextOpen] = useState(() =>
    canPersistPreferences
      ? readPreference(CONTEXT_PREFERENCE_KEY, defaultContextOpen)
      : defaultContextOpen,
  );
  const [desktopListVisible, setDesktopListVisible] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  const isTablet = useMediaQuery('(min-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1280px)');
  const shouldRenderSplitLayout = isTablet;

  useEffect(() => {
    if (!contextAvailable && contextOpen) {
      setContextOpen(false);
    }
  }, [contextAvailable, contextOpen]);

  useEffect(() => {
    if (shouldRenderSplitLayout) {
      setMobileListOpen(false);
    }
  }, [shouldRenderSplitLayout]);

  useEffect(() => {
    if (!canPersistPreferences) {
      return;
    }

    writePreference(CONTEXT_PREFERENCE_KEY, contextOpen);
  }, [canPersistPreferences, contextOpen]);

  useEffect(() => {
    if (typeof telemetry === 'function') {
      telemetry('chat.context.toggle', { open: contextOpen });
    }
  }, [contextOpen, telemetry]);

  const handleToggleListVisibility = useCallback(() => {
    if (isDesktop) {
      setDesktopListVisible((previous) => {
        const next = !previous;
        if (next) {
          setContextOpen(false);
        }
        return next;
      });
      return;
    }

    if (!isTablet) {
      setMobileListOpen((previous) => !previous);
    }
  }, [isDesktop, isTablet]);

  const handleToggleContext = useCallback(() => {
    if (!contextAvailable) {
      return;
    }

    setContextOpen((previous) => {
      const next = !previous;
      if (next && isDesktop) {
        setDesktopListVisible(false);
      }
      return next;
    });
  }, [contextAvailable, isDesktop]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if ((event.key === 'l' || event.key === 'L') && event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        handleToggleListVisibility();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleToggleListVisibility]);

  const contextDrawerOpen = Boolean(contextAvailable && contextOpen);
  const headerListButtonLabel = desktopListVisible ? 'Ocultar lista' : 'Mostrar lista';

  return {
    canPersistPreferences,
    contextOpen,
    contextDrawerOpen,
    setContextOpen,
    desktopListVisible,
    setDesktopListVisible,
    mobileListOpen,
    setMobileListOpen,
    headerListButtonLabel,
    handleToggleListVisibility,
    handleToggleContext,
    shouldRenderSplitLayout,
    isDesktop,
  };
};

export default useInboxLayoutState;
