/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseWhatsAppInstances, mockToastError } = vi.hoisted(() => ({
  mockUseWhatsAppInstances: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/features/whatsapp/hooks/useWhatsAppInstances.jsx', () => ({
  __esModule: true,
  default: (...args) => mockUseWhatsAppInstances(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args) => mockToastError(...args),
  },
}));

let ManualConversationDialog;

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

describe('ManualConversationDialog', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockUseWhatsAppInstances.mockReset();
    mockToastError.mockReset();
    mockUseWhatsAppInstances.mockReturnValue({
      instances: [],
      loadInstances: vi.fn(),
    });
    ManualConversationDialog = (await import('../ManualConversationDialog.jsx')).default;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renderiza apenas instâncias conectadas no seletor', async () => {
    mockUseWhatsAppInstances.mockReturnValue({
      instances: [
        { id: 'connected-1', name: 'Instância A', connected: true },
        { id: 'connected-2', displayId: 'inst-002', status: 'connected' },
        { id: 'pending-3', name: 'Pendente', status: 'connecting' },
      ],
      loadInstances: vi.fn(),
    });

    render(
      <ManualConversationDialog open onOpenChange={() => {}} onSubmit={vi.fn()} onSuccess={vi.fn()} />
    );

    const trigger = screen.getByRole('combobox', { name: /instância do whatsapp/i });
    const user = userEvent.setup();
    await user.click(trigger);

    const options = await screen.findAllByRole('option');
    const optionLabels = options.map((option) => option.textContent);

    expect(optionLabels).toEqual(['Instância A', 'inst-002']);
  });

  it('envia o instanceId selecionado no payload', async () => {
    mockUseWhatsAppInstances.mockReturnValue({
      instances: [
        { id: 'connected-1', name: 'Instância A', connected: true },
      ],
      loadInstances: vi.fn(),
    });

    const onSubmit = vi.fn().mockResolvedValue({});
    const onSuccess = vi.fn();

    render(
      <ManualConversationDialog
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />
    );

    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/telefone/i), '(11) 99999-1234');
    await user.type(screen.getByLabelText(/mensagem inicial/i), ' Olá ');

    const trigger = screen.getByRole('combobox', { name: /instância do whatsapp/i });
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Instância A' }));

    await user.click(screen.getByRole('button', { name: /iniciar conversa/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit).toHaveBeenCalledWith({
      phone: '11999991234',
      message: 'Olá',
      instanceId: 'connected-1',
    });

    expect(onSuccess).toHaveBeenCalledWith({}, {
      phone: '11999991234',
      message: 'Olá',
      instanceId: 'connected-1',
    });
  });
});
