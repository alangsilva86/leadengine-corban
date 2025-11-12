/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CreateInstanceDialog from '../CreateInstanceDialog.jsx';

const { passthrough } = vi.hoisted(() => {
  const factory = (Tag = 'div') => {
    const Component = ({ children, ...props }) => <Tag {...props}>{children}</Tag>;
    return Component;
  };

  return { passthrough: factory };
});

vi.mock('@/components/ui/dialog.jsx', () => ({
  Dialog: passthrough('div'),
  DialogContent: passthrough('div'),
  DialogDescription: passthrough('p'),
  DialogFooter: passthrough('div'),
  DialogHeader: passthrough('div'),
  DialogTitle: passthrough('h2'),
}));

vi.mock('@/components/ui/button.jsx', () => ({ Button: passthrough('button') }));
vi.mock('@/components/ui/input.jsx', () => ({ Input: passthrough('input') }));
vi.mock('@/components/ui/label.jsx', () => ({ Label: passthrough('label') }));
vi.mock('lucide-react', () => ({ AlertCircle: () => <span data-testid="alert-icon" /> }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CreateInstanceDialog', () => {
  it('normaliza o payload enviado e fecha o diálogo após sucesso', async () => {
    const onSubmit = vi.fn(async () => undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CreateInstanceDialog open defaultName="  Instância  " onSubmit={onSubmit} onOpenChange={onOpenChange} />
    );

    const nameInput = screen.getByLabelText('Nome do canal');
    const idInput = screen.getByLabelText('Identificador do canal (opcional)');
    const submitButton = screen.getByRole('button', { name: /Criar canal/i });

    await user.clear(nameInput);
    expect(submitButton).toBeDisabled();

    await user.type(nameInput, '  WhatsApp Vendas  ');
    await user.type(idInput, '  vendas-principal  ');
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit).toHaveBeenCalledWith({ name: 'WhatsApp Vendas', id: '  vendas-principal  ' });

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('exibe mensagem de erro e mantém o diálogo aberto em falhas', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('Falha ao criar instância');
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<CreateInstanceDialog open onSubmit={onSubmit} onOpenChange={onOpenChange} />);

    const submitButton = screen.getByRole('button', { name: /Criar canal/i });
    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    expect(await screen.findByText('Falha ao criar instância')).toBeInTheDocument();
    expect(submitButton).toBeEnabled();
  });
});
