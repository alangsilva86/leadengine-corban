import { afterEach, describe, expect, it, vi } from 'vitest';

describe('api buildUrl', () => {
  const originalEnv = { ...process.env };

  const importApiModule = async () => {
    vi.resetModules();
    const module = await import('../api.js');
    return module;
  };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('keeps absolute URLs intact', async () => {
    const { buildUrl } = await importApiModule();
    expect(buildUrl('https://example.com/foo')).toBe('https://example.com/foo');
  });

  it('merges absolute base with path without duplicating prefix', async () => {
    process.env.VITE_API_URL = 'https://api.example.com/api';
    const { buildUrl } = await importApiModule();
    expect(buildUrl('/api/auth/me')).toBe('https://api.example.com/api/auth/me');
  });

  it('handles relative base paths without duplicating segments', async () => {
    process.env.VITE_API_URL = '/api';
    const { buildUrl } = await importApiModule();
    const expected = new URL('/api/auth/me', window.location.origin).toString();
    expect(buildUrl('/api/auth/me')).toBe(expected);
    expect(buildUrl('auth/me')).toBe(expected);
  });
});
