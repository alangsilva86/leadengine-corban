import { describe, it, expect, vi } from 'vitest';
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
    const button = { focus: vi.fn() };

    action?.run?.({
      ticket: null,
      handlers: {},
      openDialog,
      returnFocus: button,
    } as CommandActionRuntimeContext);

    expect(openDialog).toHaveBeenCalledWith('register-result', { returnFocus: button });
  });
});
