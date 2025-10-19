/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import {
  MANUAL_CONVERSATION_DEPRECATION_MESSAGE,
  useManualConversationLauncher,
} from '../useManualConversationLauncher.js';

describe('useManualConversationLauncher', () => {
  const createWrapper = () => {
    const client = new QueryClient();
    return ({ children }) => createElement(QueryClientProvider, { client }, children);
  };

  it('rejeita imediatamente informando que o fluxo manual foi aposentado', async () => {
    const { result } = renderHook(() => useManualConversationLauncher(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.launch({
        phone: '(11) 98888-7766',
        message: '  Olá  ',
        instanceId: 'instance-123',
      })
    ).rejects.toThrowError(MANUAL_CONVERSATION_DEPRECATION_MESSAGE);

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });

    expect(result.current.error.message).toBe(MANUAL_CONVERSATION_DEPRECATION_MESSAGE);
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.unavailableReason).toBe(MANUAL_CONVERSATION_DEPRECATION_MESSAGE);
  });
});
