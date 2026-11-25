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
    ticketId: null,
    contactName: 'Maria Aparecida Souza',
    disabled: false,
    onSend: vi.fn(async () => true),
    onCreateNote: vi.fn(),
    onTyping: vi.fn(),
    isSending: false,
    sendError: null,
    aiError: null,
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
  const Wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

  const result = render(<Composer {...props} />, { wrapper: Wrapper });
  return { ...result, props };
};

const getMessageInput = () => screen.getByRole('textbox', { name: /Mensagem para/ });

describe('Composer', () => {
  afterEach(() => {
    cleanup();
    activeQueryClient?.clear();
    activeQueryClient = null;
    window.sessionStorage.clear();
  });

  it('dá nome acessível ao campo e desabilita "Enviar" sem conteúdo', async () => {
    renderComposer();
    const user = userEvent.setup();

    expect(getMessageInput()).toHaveAccessibleName('Mensagem para Maria Aparecida Souza');
    const send = screen.getByRole('button', { name: 'Enviar' });
    expect(send).toBeDisabled();

    await user.type(getMessageInput(), 'Olá');
    expect(send).toBeEnabled();
  });

  it('envia com Enter e quebra linha com Shift+Enter', async () => {
    const { props } = renderComposer();
    const user = userEvent.setup();

    await user.type(getMessageInput(), 'Primeira linha{Shift>}{Enter}{/Shift}segunda');
    expect(props.onSend).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(props.onSend).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Primeira linha\nsegunda', attachments: [] }),
    );
    expect(getMessageInput()).toHaveValue('');
  });

  it('insere o modelo no campo (com o nome do cliente) sem enviar', async () => {
    const { props } = renderComposer();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Modelos de mensagem' }));
    await user.click(await screen.findByRole('button', { name: /Boas-vindas/ }));

    expect(props.onSend).not.toHaveBeenCalled();
    expect(getMessageInput().value).toContain('Olá Maria, tudo bem?');
    expect(getMessageInput().value).not.toContain('{{nome}}');
  });

  it('abre respostas rápidas com "/" e insere a escolhida', async () => {
    const { props } = renderComposer();
    const user = userEvent.setup();

    await user.type(getMessageInput(), '/sau');
    expect(screen.getByRole('listbox', { name: 'Respostas rápidas' })).toBeInTheDocument();

    await user.keyboard('{Enter}');

    expect(props.onSend).not.toHaveBeenCalled();
    expect(getMessageInput()).toHaveValue('Olá Maria! Aqui é da Corban, tudo bem?');
  });

  it('salva nota interna no modo "Nota interna" sem enviar ao cliente', async () => {
    const { props } = renderComposer();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: /Nota interna/ }));
    await user.type(screen.getByRole('textbox', { name: 'Nota interna para a equipe' }), 'Cliente pediu retorno');
    await user.click(screen.getByRole('button', { name: 'Salvar nota' }));

    expect(props.onCreateNote).toHaveBeenCalledWith('Cliente pediu retorno');
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('pede sugestão da IA e permite parar a geração', async () => {
    const onGenerate = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    const { rerender } = renderComposer({
      aiStreaming: { status: 'idle', onGenerate, onCancel, reset: vi.fn(), toolCalls: [], error: null },
    });

    await user.click(screen.getByRole('button', { name: 'Sugerir resposta com IA' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);

    rerender(
      <Composer
        contactName="Maria"
        onSend={vi.fn()}
        aiStreaming={{ status: 'streaming', onGenerate, onCancel, reset: vi.fn(), toolCalls: [], error: null }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Parar sugestão da IA' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('explica o bloqueio quando a IA está respondendo e oferece "Assumir"', async () => {
    const onTakeOver = vi.fn();
    renderComposer({ aiAutonomous: true, onTakeOver });
    const user = userEvent.setup();

    expect(screen.getByText('IA respondendo esta conversa')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Assumir' }));
    expect(onTakeOver).toHaveBeenCalledTimes(1);
  });

  it('oferece "Reabrir" em conversa encerrada', async () => {
    const onReopen = vi.fn();
    renderComposer({ closed: true, onReopen });
    const user = userEvent.setup();

    expect(screen.getByText('Conversa encerrada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reabrir/ }));
    expect(onReopen).toHaveBeenCalledTimes(1);
  });

  it('mantém um rascunho por conversa', async () => {
    const user = userEvent.setup();
    const first = renderComposer({ ticketId: 'ticket-a' });
    await user.type(getMessageInput(), 'Rascunho da conversa A');
    first.unmount();

    const second = renderComposer({ ticketId: 'ticket-b' });
    expect(getMessageInput()).toHaveValue('');
    second.unmount();

    renderComposer({ ticketId: 'ticket-a' });
    expect(getMessageInput()).toHaveValue('Rascunho da conversa A');
  });
});
