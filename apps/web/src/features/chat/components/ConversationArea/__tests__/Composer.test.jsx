/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Composer } from '../Composer.jsx';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

let activeQueryClient = null;

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
    aiStreaming: {
      status: 'idle',
      onGenerate: vi.fn(),
      onCancel: vi.fn(),
      reset: vi.fn(),
      toolCalls: [],
      error: null,
    },
    ...overrideProps,
  };

  const queryClient = new QueryClient();
  activeQueryClient = queryClient;
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const result = render(<Composer {...props} />, { wrapper: Wrapper });
  return { ...result, props };
};

describe('Composer - AI mode control', () => {
  afterEach(() => {
    cleanup();
    activeQueryClient?.clear();
    activeQueryClient = null;
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

  it('aciona geração de IA quando disponível', async () => {
    const onGenerate = vi.fn();
    const aiStreaming = {
      status: 'idle',
      onGenerate,
      onCancel: vi.fn(),
      reset: vi.fn(),
      toolCalls: [],
      error: null,
    };
    renderComposer({ aiStreaming });
    const user = userEvent.setup();

    const button = screen.getByRole('button', { name: /gerar resposta com ia/i });
    await user.click(button);

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('permite cancelar a geração quando em andamento', async () => {
    const onCancel = vi.fn();
    const aiStreaming = {
      status: 'streaming',
      onGenerate: vi.fn(),
      onCancel,
      reset: vi.fn(),
      toolCalls: [],
      error: null,
    };
    renderComposer({ aiStreaming });
    const user = userEvent.setup();

    const button = screen.getByRole('button', { name: /cancelar geração da ia/i });
    await user.click(button);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
