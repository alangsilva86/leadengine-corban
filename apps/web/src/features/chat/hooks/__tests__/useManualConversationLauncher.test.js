/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
}));

vi.mock('@/lib/api.js', () => ({
  apiPost: (...args) => mockApiPost(...args),
}));

let useManualConversationLauncher;

describe('useManualConversationLauncher', () => {
  const createWrapper = () => {
    const client = new QueryClient();
    return ({ children }) => createElement(QueryClientProvider, { client }, children);
  };

  afterEach(() => {
    mockApiPost.mockReset();
  });

  it('inclui o instanceId no payload enviado para a API', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { instanceId: 'instance-123' } });
    const module = await import('../useManualConversationLauncher.js');
    useManualConversationLauncher = module.useManualConversationLauncher;

    const { result } = renderHook(() => useManualConversationLauncher(), {
      wrapper: createWrapper(),
    });

    const response = await result.current.launch({
      phone: '(11) 98888-7766',
      message: '  Olá  ',
      instanceId: 'instance-123',
    });

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledTimes(1);
    });

    expect(mockApiPost).toHaveBeenCalledWith('/api/manual-conversations', {
      phone: '11988887766',
      message: 'Olá',
      instanceId: 'instance-123',
    });

    expect(result.current.data.instanceId).toBe('instance-123');
    expect(response.instanceId).toBe('instance-123');
  });
});
