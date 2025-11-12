/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import useOnboardingStepLabel from '../useOnboardingStepLabel.js';

describe('useOnboardingStepLabel', () => {
  const stages = [
    { id: 'channels', label: 'Instâncias & Canais' },
    { id: 'campaigns', label: 'Campanhas' },
    { id: 'inbox', label: 'Inbox' },
  ];

  it('computes step label and next stage when stage is present', () => {
    const { result } = renderHook(() =>
      useOnboardingStepLabel({
        stages,
        targetStageId: 'campaigns',
        fallbackStep: { number: 2, label: 'Passo 2', nextStage: 'Campanhas' },
      })
    );

    expect(result.current.stepLabel).toBe('Passo 2 de 3');
    expect(result.current.nextStage).toBe('Inbox');
  });

  it('returns fallback values when stages are unavailable', () => {
    const { result } = renderHook(() =>
      useOnboardingStepLabel({
        stages: null,
        targetStageId: 'channels',
        fallbackStep: { number: 2, label: 'Passo 2', nextStage: 'Inbox' },
      })
    );

    expect(result.current.stepLabel).toBe('Passo 2');
    expect(result.current.nextStage).toBe('Inbox');
  });

  it('falls back to first stage label when target is missing', () => {
    const { result } = renderHook(() =>
      useOnboardingStepLabel({
        stages,
        targetStageId: 'reports',
        fallbackStep: { number: 3, label: 'Passo 3', nextStage: 'Relatórios' },
      })
    );

    expect(result.current.stepLabel).toBe('Passo 3 de 3');
    expect(result.current.nextStage).toBe('Instâncias & Canais');
  });
});
