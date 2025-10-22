import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_QUICK_ACTIONS } from './inventory.ts';

const getAction = (id) => DEFAULT_QUICK_ACTIONS.find((action) => action.id === id);

describe('chat command inventory', () => {
  it('disables send-sms when handler or phone is missing', () => {
    const action = getAction('send-sms');
    const context = {
      handlers: {},
      phoneNumber: null,
      capabilities: {},
    };

    expect(action?.canExecute?.(context)).toBe(false);
  });

  it('enables send-sms when handler and phone exist', () => {
    const action = getAction('send-sms');
    const context = {
      handlers: {
        onSendSMS: () => {},
      },
      phoneNumber: '+5511999999999',
      capabilities: { canSendSms: true },
    };

    expect(action?.canExecute?.(context)).toBe(true);
  });

  it('opens register-result dialog instead of executing directly', () => {
    const action = getAction('register-result');
    const openDialog = vi.fn();
    const button = { focus: vi.fn() };

    action?.run?.({ openDialog, returnFocus: button });

    expect(openDialog).toHaveBeenCalledWith('register-result', { returnFocus: button });
  });
});
