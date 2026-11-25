/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ConversationHeader, { resolveHeaderPrimaryAction } from '../ConversationHeader.jsx';
import ContactDetailsPanel from '../ContactDetailsPanel.jsx';
import { getTicketLeadStage } from '../../../utils/leadStage.js';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/hooks/use-clipboard.js', () => ({
  __esModule: true,
  useClipboard: () => ({
    copy: vi.fn(),
  }),
}));

vi.mock('../CallResultDialog.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="call-result-dialog">CallResultDialog</div>,
}));

vi.mock('../LossReasonDialog.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="loss-reason-dialog">LossReasonDialog</div>,
}));

vi.mock('@/features/chat/hooks/useInstancePresentation.js', () => ({
  __esModule: true,
  default: () => ({ label: 'Instância mock', color: '#94A3B8', phone: null, number: null }),
}));

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
});

// Valores antigos (Inbox/CRM) e ids novos do contrato → etapa do funil único do lead.
const STAGE_SCENARIOS = [
  { ticket: { stage: 'novo' }, stage: 'novo', label: 'Novo' },
  { ticket: { stage: 'conectado' }, stage: 'contato', label: 'Em contato' },
  { ticket: { pipelineStep: 'Qualificação' }, stage: 'qualificacao', label: 'Qualificação' },
  { ticket: { stage: 'proposta' }, stage: 'proposta', label: 'Proposta' },
  { ticket: { stage: 'AGUARDANDO_CLIENTE' }, stage: 'documentacao', label: 'Documentação' },
  { ticket: { stage: 'documentos_averbacao' }, stage: 'averbacao', label: 'Averbação' },
  { ticket: { metadata: { pipelineStep: 'Liquidação' } }, stage: 'liquidacao', label: 'Liquidação' },
  { ticket: { stage: 'aprovado_liquidacao' }, stage: 'ganho', label: 'Ganho' },
  { ticket: { stage: 'perdido' }, stage: 'perdido', label: 'Perdido' },
  { ticket: { stage: 'Reciclar' }, stage: 'reciclar', label: 'Reciclar' },
  { ticket: { stage: 'desconhecido' }, stage: 'novo', label: 'Novo' },
  { ticket: {}, stage: 'novo', label: 'Novo' },
];

describe('etapa do lead na conversa', () => {
  it('normaliza valores antigos e novos para o funil único', () => {
    STAGE_SCENARIOS.forEach(({ ticket, stage }) => {
      expect(getTicketLeadStage(ticket)).toBe(stage);
    });
  });

  it('prioriza `stage` (dono: o lead) sobre o `pipelineStep` legado', () => {
    expect(getTicketLeadStage({ stage: 'proposta', pipelineStep: 'Novo' })).toBe('proposta');
  });

  it('pede "Registrar resultado" só em Liquidação, Ganho e Perdido', () => {
    const base = { ticket: { id: 't', status: 'OPEN' }, assignee: { id: 'a' }, aiMode: 'assist', windowState: null };
    ['liquidacao', 'ganho', 'perdido'].forEach((stage) => {
      expect(resolveHeaderPrimaryAction({ ...base, stage })?.id).toBe('register-result');
    });
    ['novo', 'contato', 'qualificacao', 'proposta', 'documentacao', 'averbacao', 'reciclar'].forEach((stage) => {
      expect(resolveHeaderPrimaryAction({ ...base, stage })).toBeNull();
    });
    expect(resolveHeaderPrimaryAction({ ...base, ticket: { id: 't', status: 'CLOSED' }, stage: 'ganho' })).toBeNull();
  });

  it('mostra o chip da etapa com o rótulo do contrato', () => {
    STAGE_SCENARIOS.forEach(({ ticket, label }) => {
      const { unmount } = render(
        <ConversationHeader ticket={{ id: 'ticket-x', status: 'OPEN', contact: { name: 'Cliente Teste' }, window: {}, ...ticket }} />,
      );
      expect(screen.getByRole('button', { name: `Etapa do lead: ${label}` })).toBeInTheDocument();
      unmount();
    });
  });

  it('abre o seletor do funil e muda a etapa pelo chip', async () => {
    const onStageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ConversationHeader
        ticket={{ id: 'ticket-q', status: 'OPEN', stage: 'qualificacao', contact: { name: 'Cliente Teste' }, window: {} }}
        onStageChange={onStageChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Etapa do lead: Qualificação. Mudar etapa' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Etapa do lead')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Qualificação (etapa atual)' })).toHaveAttribute('aria-current', 'step');
    expect(within(dialog).getByRole('button', { name: 'Em contato (concluída)' })).toBeEnabled();

    await user.click(within(dialog).getByRole('button', { name: 'Proposta' }));
    expect(onStageChange).toHaveBeenCalledWith('proposta');
  });

  it('desabilita as transições proibidas e explica o motivo (Perdido → só Reciclar)', async () => {
    const user = userEvent.setup();
    render(
      <ConversationHeader
        ticket={{ id: 'ticket-p', status: 'OPEN', stage: 'perdido', contact: { name: 'Cliente Teste' }, window: {} }}
        onStageChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^Etapa do lead: Perdido/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Proposta' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Ganho' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Reciclar' })).toBeEnabled();
    expect(within(dialog).getByText('Lead perdido só pode voltar para Reciclar.')).toBeInTheDocument();
  });
});

describe('ContactDetailsPanel channel icons', () => {
  const renderPanelWithChannel = (channel) => {
    const ticket = {
      id: 'ticket-channel',
      status: 'OPEN',
      channel,
      contact: { id: 'contact-1', name: 'Maria Cliente', phone: '+55 11 90000-0000' },
      metadata: { contactPhone: '+55 11 90000-0000' },
      timeline: {
        lastDirection: 'INBOUND',
        lastInboundAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    };
    render(<ContactDetailsPanel ticket={ticket} />);
  };

  it('renders WhatsApp icon when last interaction is via WhatsApp', () => {
    renderPanelWithChannel('whatsapp');
    expect(screen.getByTestId('channel-icon-whatsapp')).toBeInTheDocument();
  });

  it('renders phone icon when last interaction is via voice channel', () => {
    renderPanelWithChannel('voice');
    expect(screen.getByTestId('channel-icon-voice')).toBeInTheDocument();
  });

  it('renders email icon when last interaction is via email', () => {
    renderPanelWithChannel('email');
    expect(screen.getByTestId('channel-icon-email')).toBeInTheDocument();
  });

  it('links to the contact and its opportunities', () => {
    renderPanelWithChannel('whatsapp');
    expect(screen.getByRole('link', { name: 'Abrir contato' })).toHaveAttribute('href', '/contacts/contact-1');
    expect(screen.getByRole('link', { name: 'Ver oportunidades' })).toHaveAttribute(
      'href',
      '/crm/opportunities?contactId=contact-1',
    );
  });
});

describe('ConversationHeader component', () => {
  beforeAll(() => {
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(() => callback(Date.now()), 0));
    vi.stubGlobal('cancelAnimationFrame', (handle) => clearTimeout(handle));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  const baseTicket = {
    id: 'ticket-header',
    status: 'OPEN',
    channel: 'WHATSAPP',
    stage: 'proposta',
    userId: 'agent-1',
    contact: { id: 'contact-1', name: 'Cliente Header', phone: '+55 11 99999-0000' },
    window: { isOpen: true, expiresAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString() },
    timeline: { lastDirection: 'OUTBOUND', lastInboundAt: new Date(Date.now() - 3600 * 1000).toISOString() },
  };

  it('mostra nome em h2 e nenhuma ação principal quando não há o que fazer', () => {
    render(<ConversationHeader ticket={baseTicket} onAssign={vi.fn()} currentUser={{ id: 'agent-1' }} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Cliente Header' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Assumir conversa|Enviar modelo|Registrar resultado|Ligar agora/ }),
    ).not.toBeInTheDocument();
  });

  it('pede "Assumir conversa" quando ninguém está com a conversa', async () => {
    const onAssign = vi.fn();
    const ticket = { ...baseTicket, userId: undefined };
    render(<ConversationHeader ticket={ticket} onAssign={onAssign} currentUser={{ id: 'agent-9' }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Assumir conversa' }));
    expect(onAssign).toHaveBeenCalledWith(ticket, 'agent-9');
  });

  it('pede "Assumir da IA" quando a IA está no comando', async () => {
    const onTakeOver = vi.fn();
    render(<ConversationHeader ticket={baseTicket} aiMode="auto" onTakeOver={onTakeOver} onAssign={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Assumir da IA' }));
    expect(onTakeOver).toHaveBeenCalledTimes(1);
  });

  it('pede "Enviar modelo" quando a janela de 24 h encerrou — e não envia nada sozinho', async () => {
    const onOpenTemplates = vi.fn();
    const ticket = { ...baseTicket, window: { isOpen: false, expiresAt: null } };
    render(<ConversationHeader ticket={ticket} onOpenTemplates={onOpenTemplates} onAssign={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Enviar modelo' }));
    expect(onOpenTemplates).toHaveBeenCalledTimes(1);
  });

  it('pede "Registrar resultado" nas etapas de fechamento', () => {
    render(<ConversationHeader ticket={{ ...baseTicket, stage: 'liquidacao' }} onAssign={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Registrar resultado' })).toBeInTheDocument();
  });

  it('nunca mostra "Ligar agora" como ação principal em conversa de WhatsApp', () => {
    render(
      <ConversationHeader
        ticket={{ ...baseTicket, stage: 'novo', contact: { id: 'c', name: 'Sem telefone' } }}
        onAssign={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Ligar/ })).not.toBeInTheDocument();
  });

  it('alterna o painel do contato com aria-pressed', async () => {
    const onToggleDetails = vi.fn();
    const { rerender } = render(<ConversationHeader ticket={baseTicket} onToggleDetails={onToggleDetails} />);

    const toggle = screen.getByRole('button', { name: 'Mostrar detalhes do contato' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(onToggleDetails).toHaveBeenCalledTimes(1);

    rerender(<ConversationHeader ticket={baseTicket} onToggleDetails={onToggleDetails} detailsOpen />);
    expect(screen.getByRole('button', { name: 'Mostrar detalhes do contato' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('move o modo da IA para "Mais ações" e propaga as escolhas', async () => {
    const onAiModeChange = vi.fn();
    const onTakeOver = vi.fn();
    const user = userEvent.setup();

    render(
      <ConversationHeader
        ticket={baseTicket}
        aiMode="assist"
        aiConfidence={0.85}
        onAiModeChange={onAiModeChange}
        onTakeOver={onTakeOver}
        onGiveBackToAi={vi.fn()}
      />,
    );

    const openAiSubmenu = async () => {
      await user.click(screen.getByRole('button', { name: 'Mais ações' }));
      const subTrigger = await screen.findByTestId('ai-mode-menu-trigger');
      subTrigger.focus();
      await user.keyboard('{ArrowRight}');
    };

    await openAiSubmenu();
    const manual = await screen.findByRole('menuitemradio', { name: 'Agente no comando' });
    manual.focus();
    await user.keyboard('{Enter}');
    expect(onAiModeChange).toHaveBeenCalledWith('manual');

    await openAiSubmenu();
    const takeOver = await screen.findByRole('menuitem', { name: 'Assumir' });
    takeOver.focus();
    await user.keyboard('{Enter}');
    expect(onTakeOver).toHaveBeenCalledTimes(1);
  });
});
