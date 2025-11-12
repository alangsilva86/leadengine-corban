/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import useOnboardingStepLabel from '../useOnboardingStepLabel.js';

describe('useOnboardingStepLabel', () => {
  const stages = [
    { id: 'channels', label: 'Instâncias & Canais' },
    { id: 'agreements', label: 'Convênios' },
    { id: 'campaigns', label: 'Campanhas' },
    { id: 'inbox', label: 'Inbox' },
  ];

  it('computes step label and next stage when stage is present', () => {
    const { result } = renderHook(() =>
      useOnboardingStepLabel({
        stages,
        targetStageId: 'agreements',
        fallbackStep: { number: 2, label: 'Passo 2', nextStage: 'Campanhas' },
      })
    );

    expect(result.current.stepLabel).toBe('Passo 2 de 4');
    expect(result.current.nextStage).toBe('Campanhas');
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
        fallbackStep: { number: 4, label: 'Passo 4', nextStage: 'Relatórios' },
      })
    );

    expect(result.current.stepLabel).toBe('Passo 4 de 4');
    expect(result.current.nextStage).toBe('Instâncias & Canais');
  });
});
