/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Composer } from '../Composer.jsx';

const renderComposer = (overrideProps = {}) => {
  const props = {
    disabled: false,
    onSend: vi.fn(),
    onTemplate: vi.fn(),
    onCreateNote: vi.fn(),
    onTyping: vi.fn(),
    isSending: false,
    sendError: null,
    aiConfidence: null,
    aiError: null,
    aiMode: 'manual',
    aiModeChangeDisabled: false,
    onAiModeChange: vi.fn(),
    ...overrideProps,
  };

  const result = render(<Composer {...props} />);
  return { ...result, props };
};

describe('Composer - AI mode control', () => {
  afterEach(() => {
    cleanup();
  });

  it('exibe estado manual como inativo', () => {
    renderComposer({ aiMode: 'manual' });

    const button = screen.getByRole('button', { name: /selecionar modo da ia/i });

    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('destaca quando um modo assistido está ativo', () => {
    renderComposer({ aiMode: 'assist' });

    const button = screen.getByRole('button', { name: /selecionar modo da ia/i });

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Assistida')).toBeInTheDocument();
  });

  it('permite alterar o modo pelo menu de IA', async () => {
    const onAiModeChange = vi.fn();
    renderComposer({ aiMode: 'manual', onAiModeChange });
    const user = userEvent.setup();

    const button = screen.getByRole('button', { name: /selecionar modo da ia/i });
    await user.click(button);

    const option = await screen.findByRole('menuitemradio', { name: /ia autônoma/i });
    await user.click(option);

    expect(onAiModeChange).toHaveBeenCalledWith('auto');
  });
});
