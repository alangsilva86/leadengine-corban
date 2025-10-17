import { useCallback } from 'react';

export const useSavedViewPrompt = ({
  canSaveView,
  matchingView,
  savedViewsCount,
  saveCurrentView,
  selectSavedView,
}) => {
  return useCallback(() => {
    if (!canSaveView) {
      if (matchingView) {
        selectSavedView(matchingView);
      }
      return;
    }

    const defaultName = `Visão ${savedViewsCount + 1}`;
    const promptValue =
      typeof window !== 'undefined'
        ? window.prompt('Nome da visão', defaultName)
        : null;

    if (!promptValue) {
      return;
    }

    saveCurrentView(promptValue);
  }, [canSaveView, matchingView, savedViewsCount, saveCurrentView, selectSavedView]);
};

export default useSavedViewPrompt;
