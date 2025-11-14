import { describe, expect, it } from 'vitest';

import { SalesStage, canTransition, assertTransition, SALES_STAGE_TRANSITIONS } from './stages';

describe('sales stages transitions', () => {
  it('allows forward progress through the funnel', () => {
    expect(canTransition(SalesStage.NOVO, SalesStage.CONECTADO)).toBe(true);
    expect(canTransition(SalesStage.CONECTADO, SalesStage.QUALIFICACAO)).toBe(true);
    expect(canTransition(SalesStage.QUALIFICACAO, SalesStage.PROPOSTA)).toBe(true);
    expect(canTransition(SalesStage.PROPOSTA, SalesStage.DOCUMENTACAO)).toBe(true);
    expect(canTransition(SalesStage.DOCUMENTACAO, SalesStage.LIQUIDACAO)).toBe(true);
    expect(canTransition(SalesStage.LIQUIDACAO, SalesStage.APROVADO_LIQUIDACAO)).toBe(true);
  });

  it('permits recycling a deal back to prospecting stages', () => {
    expect(canTransition(SalesStage.LIQUIDACAO, SalesStage.RECICLAR)).toBe(true);
    expect(canTransition(SalesStage.RECICLAR, SalesStage.NOVO)).toBe(true);
    expect(canTransition(SalesStage.RECICLAR, SalesStage.CONECTADO)).toBe(true);
  });

  it('prevents skipping critical validation stages', () => {
    expect(canTransition(SalesStage.NOVO, SalesStage.LIQUIDACAO)).toBe(false);
    expect(canTransition(SalesStage.QUALIFICACAO, SalesStage.APROVADO_LIQUIDACAO)).toBe(false);
  });

  it('throws when asserting invalid transitions', () => {
    expect(() => assertTransition(SalesStage.NOVO, SalesStage.LIQUIDACAO)).toThrowError(
      /Invalid sales stage transition/
    );
  });

  it('exposes transition sets per stage', () => {
    const transitions = SALES_STAGE_TRANSITIONS.get(SalesStage.PROPOSTA);
    expect(transitions).toBeInstanceOf(Set);
    expect(transitions?.has(SalesStage.DOCUMENTACAO)).toBe(true);
    expect(transitions?.has(SalesStage.APROVADO_LIQUIDACAO)).toBe(false);
  });

  it('allows remaining in the same stage to represent idempotent updates', () => {
    for (const stage of Object.values(SalesStage)) {
      expect(canTransition(stage, stage as SalesStage)).toBe(true);
      expect(() => assertTransition(stage as SalesStage, stage as SalesStage)).not.toThrow();
    }
  });
});
