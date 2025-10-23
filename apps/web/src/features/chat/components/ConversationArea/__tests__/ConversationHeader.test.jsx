/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import ConversationHeader, {
  normalizeStage,
  resolvePrimaryAction,
  PrimaryActionButton,
} from '../ConversationHeader.jsx';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../utils/telemetry.js', () => ({
  __esModule: true,
  default: vi.fn(),
}));

vi.mock('../QuickComposer.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="quick-composer">QuickComposer</div>,
}));

vi.mock('../CallResultDialog.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="call-result-dialog">CallResultDialog</div>,
}));

vi.mock('../LossReasonDialog.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="loss-reason-dialog">LossReasonDialog</div>,
}));

afterEach(() => {
  cleanup();
});

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

describe('ContactSummary channel icons', () => {
  beforeAll(() => {
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      const id = setTimeout(() => callback(Date.now()), 0);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  const renderHeaderWithChannel = async (channel) => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const ticket = {
      id: 'ticket-channel',
      status: 'OPEN',
      channel: 'WHATSAPP',
      contact: { id: 'contact-1', name: 'Maria Cliente', phone: '+55 11 90000-0000' },
      metadata: { contactPhone: '+55 11 90000-0000' },
      timeline: {
        lastDirection: 'INBOUND',
        lastInboundAt: fiveMinutesAgo,
        lastOutboundAt: tenMinutesAgo,
        lastChannel: channel,
      },
    };

    render(
      <ConversationHeader
        ticket={ticket}
        typingAgents={[]}
        onAssign={() => {}}
        onScheduleFollowUp={() => {}}
        onRegisterResult={() => {}}
        onRegisterCallResult={() => {}}
        onSendTemplate={() => {}}
        onCreateNextStep={() => {}}
        onGenerateProposal={() => {}}
        onSendSMS={() => {}}
        onAttachFile={() => {}}
      />,
    );

    const user = userEvent.setup();
    const toggleButton = screen.getByRole('button', { name: /Expandir detalhes/i });
    await user.click(toggleButton);
  };

  it('renders WhatsApp icon when last interaction is via WhatsApp', async () => {
    await renderHeaderWithChannel('whatsapp');
    expect(await screen.findByTestId('channel-icon-whatsapp')).toBeInTheDocument();
  });

  it('renders phone icon when last interaction is via voice channel', async () => {
    await renderHeaderWithChannel('voice');
    expect(await screen.findByTestId('channel-icon-voice')).toBeInTheDocument();
  });

  it('renders email icon when last interaction is via email', async () => {
    await renderHeaderWithChannel('email');
    expect(await screen.findByTestId('channel-icon-email')).toBeInTheDocument();
  });
});
