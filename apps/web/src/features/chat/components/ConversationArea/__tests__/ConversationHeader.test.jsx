import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  normalizeStage,
  resolvePrimaryAction,
  PrimaryActionButton,
} from '../ConversationHeader.jsx';

const STAGE_SCENARIOS = [
  { raw: 'Novo', key: 'NOVO', hasWhatsApp: true },
  { raw: 'Conectado', key: 'CONECTADO', hasWhatsApp: true },
  { raw: 'Qualificação', key: 'QUALIFICACAO', hasWhatsApp: false },
  { raw: 'Proposta', key: 'PROPOSTA', hasWhatsApp: false },
  { raw: 'Documentação', key: 'DOCUMENTACAO', hasWhatsApp: false },
  { raw: 'Documentos Averbação', key: 'DOCUMENTOS_AVERBACAO', hasWhatsApp: false },
  { raw: 'Aguardando - Cliente', key: 'AGUARDANDO_CLIENTE', hasWhatsApp: true },
  { raw: '  aguardando//cliente  ', key: 'AGUARDANDO_CLIENTE', hasWhatsApp: true },
  { raw: 'Liquidação', key: 'LIQUIDACAO', hasWhatsApp: false },
  { raw: 'Aprovado / Liquidação', key: 'APROVADO_LIQUIDACAO', hasWhatsApp: false },
  { raw: 'Reciclar', key: 'RECICLAR', hasWhatsApp: true },
];

describe('ConversationHeader helpers', () => {
  it('normalizes stage names with accents and separators', () => {
    STAGE_SCENARIOS.forEach(({ raw, key }) => {
      expect(normalizeStage(raw)).toBe(key);
    });
  });

  it('resolves a primary action for each funnel stage', () => {
    STAGE_SCENARIOS.forEach(({ key, hasWhatsApp }) => {
      const action = resolvePrimaryAction({ stageKey: key, hasWhatsApp });
      expect(action).toBeTruthy();
      expect(action.id).toBeTypeOf('string');
      expect(action.label).toBeTypeOf('string');
    });
  });

  it('renders the primary action button when an action is provided', () => {
    STAGE_SCENARIOS.forEach(({ key, hasWhatsApp }) => {
      const action = resolvePrimaryAction({ stageKey: key, hasWhatsApp });
      const { unmount } = render(
        <PrimaryActionButton action={action} jroState="neutral" onExecute={() => {}} disabled={false} />,
      );
      expect(screen.getByRole('button', { name: action.label })).toBeInTheDocument();
      unmount();
    });
  });
});
