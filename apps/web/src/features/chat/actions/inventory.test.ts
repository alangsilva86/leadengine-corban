import { describe, it, expect, vi } from 'vitest';
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { DEFAULT_QUICK_ACTIONS } from './inventory';
import type { CommandActionRuntimeContext } from './inventory';

const getAction = (id: string) => DEFAULT_QUICK_ACTIONS.find((action) => action.id === id);

describe('chat command inventory', () => {
  it('disables send-sms when handler or phone is missing', () => {
    const action = getAction('send-sms');
    const context = {
      ticket: null,
      handlers: {},
      phoneNumber: null,
      capabilities: {},
    } as CommandActionRuntimeContext;

    expect(action?.canExecute?.(context)).toBe(false);
  });

  it('enables send-sms when handler and phone exist', () => {
    const action = getAction('send-sms');
    const context = {
      ticket: null,
      handlers: {
        onSendSMS: () => {},
      },
      phoneNumber: '+5511999999999',
      capabilities: { canSendSms: true },
    } as CommandActionRuntimeContext;

    expect(action?.canExecute?.(context)).toBe(true);
  });

  it('opens register-result dialog instead of executing directly', () => {
    const action = getAction('register-result');
    const openDialog = vi.fn();
    const button = document.createElement('button');

    if (!action) {
      throw new Error('Expected action "register-result" to exist.');
    }

    if (action.type === 'menu') {
      throw new Error('Expected action "register-result" to be a command action.');
    }

    const context: CommandActionRuntimeContext = {
      ticket: null,
      handlers: {},
      openDialog,
      returnFocus: button,
    };

    action.run(context);

    expect(openDialog).toHaveBeenCalledWith('register-result', { returnFocus: button });
  });

  it('pede ajuda à IA e registra nota quando possível', async () => {
    const action = getAction('ask-ai-help');
    if (!action) {
      throw new Error('Expected action "ask-ai-help" to exist.');
    }

    const onCreateNote = vi.fn();
    const requestSuggestions = vi.fn().mockResolvedValue({
      nextStep: 'Envie a minuta atualizada',
      tips: ['Confirme prazos com o cliente'],
      objections: [],
      confidence: 45,
    });

    const context = {
      ticket: { id: 'ticket-123' },
      handlers: { onCreateNote },
      ai: { requestSuggestions },
      timeline: [],
    } as unknown as CommandActionRuntimeContext;

    await action.run(context);

    expect(requestSuggestions).toHaveBeenCalledWith({
      ticket: context.ticket,
      timeline: [],
    });
    expect(onCreateNote).toHaveBeenCalledWith(expect.stringContaining('Próximo passo'));
  });
});
