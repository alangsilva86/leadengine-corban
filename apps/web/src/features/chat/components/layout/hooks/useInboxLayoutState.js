import { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query.js';
import emitInboxTelemetry from '../../../utils/telemetry.js';
import { CONTEXT_PREFERENCE_KEY, readPreference, writePreference } from '../preferences.ts';

const isTypingTarget = (target) => {
  if (!target || typeof target !== 'object') return false;
  const tagName = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
  return Boolean(target.isContentEditable) || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

/**
 * Layout do Inbox:
 * - ≥1440px: lista | conversa | painel do contato (painel fixo, lembrado entre sessões);
 * - 1024–1439px: lista | conversa, painel do contato como folha sobreposta
 *   (com o menu lateral do app aberto, 1280px deixaria a conversa com ~380px);
 * - <1024px: uma tela por vez (lista → conversa → voltar).
 */
const useInboxLayoutState = ({
  defaultContextOpen = false,
  contextAvailable = true,
  currentUser,
  telemetry = emitInboxTelemetry,
} = {}) => {
  const isTablet = useMediaQuery('(min-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1280px)');
  const isWide = useMediaQuery('(min-width: 1440px)');
  const shouldRenderSplitLayout = isTablet;

  const canPersistPreferences = Boolean(currentUser?.id);
  // Painel fixo (≥1440px): preferência lembrada.
  const [paneOpen, setPaneOpen] = useState(() =>
    canPersistPreferences ? readPreference(CONTEXT_PREFERENCE_KEY, defaultContextOpen) : defaultContextOpen,
  );
  // Folha sobreposta (<1440px): sempre começa fechada.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [desktopListVisible, setDesktopListVisible] = useState(true);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  const contextOpen = isWide ? paneOpen : sheetOpen;
  const contextDrawerOpen = Boolean(contextAvailable && contextOpen);

  useEffect(() => {
    if (!canPersistPreferences) return;
    writePreference(CONTEXT_PREFERENCE_KEY, paneOpen);
  }, [canPersistPreferences, paneOpen]);

  useEffect(() => {
    if (typeof telemetry === 'function') {
      telemetry('chat.context.toggle', { open: contextDrawerOpen });
    }
  }, [contextDrawerOpen, telemetry]);

  useEffect(() => {
    if (isWide) {
      setSheetOpen(false);
    }
  }, [isWide]);

  const setContextOpen = useCallback(
    (next) => {
      const resolve = (previous) => (typeof next === 'function' ? next(previous) : Boolean(next));
      if (isWide) {
        setPaneOpen(resolve);
      } else {
        setSheetOpen(resolve);
      }
    },
    [isWide],
  );

  const handleToggleContext = useCallback(() => {
    if (!contextAvailable) return;
    setContextOpen((previous) => !previous);
  }, [contextAvailable, setContextOpen]);

  const handleToggleListVisibility = useCallback(() => {
    if (isDesktop) {
      setDesktopListVisible((previous) => !previous);
      return;
    }
    if (!isTablet) {
      setMobileListOpen((previous) => !previous);
    }
  }, [isDesktop, isTablet]);

  // ⌥L alterna a lista — mas nunca enquanto o atendente digita.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      if (event.code === 'KeyL' || event.key === 'l' || event.key === 'L' || event.key === '¬') {
        if (event.altKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          handleToggleListVisibility();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleListVisibility]);

  return {
    canPersistPreferences,
    contextOpen,
    contextDrawerOpen,
    setContextOpen,
    desktopListVisible: isDesktop ? desktopListVisible : true,
    setDesktopListVisible,
    mobileListOpen,
    setMobileListOpen,
    headerListButtonLabel: desktopListVisible ? 'Ocultar lista' : 'Mostrar lista',
    handleToggleListVisibility,
    handleToggleContext,
    shouldRenderSplitLayout,
    isDesktop,
    isWide,
    isTablet,
  };
};

export default useInboxLayoutState;
