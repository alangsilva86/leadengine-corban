import { describe, expect, it } from 'vitest'

import { createProxyPathNormalizer, sanitizePathname } from './server.proxy-helpers.mjs'

describe('createProxyPathNormalizer', () => {
  it('returns null when proxy URL is falsy', () => {
    expect(createProxyPathNormalizer(null)).toBeNull()
    expect(createProxyPathNormalizer(undefined)).toBeNull()
  })

  it('normalizes requests without base pathname', () => {
    const normalizer = createProxyPathNormalizer('https://example.com')

    expect(normalizer.origin).toBe('https://example.com')
    expect(normalizer.basePathname).toBe('')

    const normalized = normalizer.normalizeRequestUrl('/api/users')
    expect(normalized).toBe('/api/users')
    expect(normalizer.buildTargetUrl('/api/users')).toBe('https://example.com/api/users')
    expect(normalized).not.toMatch(/\/api\/.*\/api\//)
  })

  it('prefixes the configured base pathname exactly once', () => {
    const normalizer = createProxyPathNormalizer('https://example.com/base')

    expect(normalizer.origin).toBe('https://example.com')
    expect(normalizer.basePathname).toBe('/base')

    const normalized = normalizer.normalizeRequestUrl('/api/users')
    expect(normalized).toBe('/base/api/users')
    expect(normalizer.buildTargetUrl('/api/users')).toBe('https://example.com/base/api/users')
    expect(normalized).not.toMatch(/\/base\/.*\/base\//)

    const alreadyPrefixed = normalizer.normalizeRequestUrl('/base/api/users')
    expect(alreadyPrefixed).toBe('/base/api/users')
    expect(normalizer.buildTargetUrl('/base/api/users')).toBe('https://example.com/base/api/users')
  })

  it('handles multi-segment base pathnames and preserves query strings', () => {
    const normalizer = createProxyPathNormalizer('https://example.com/api/v1/')

    expect(normalizer.basePathname).toBe('/api/v1')

    const normalized = normalizer.normalizeRequestUrl('/socket.io/?transport=websocket')
    expect(normalized).toBe('/api/v1/socket.io/?transport=websocket')
    expect(normalized).not.toMatch(/\/socket\.io\/.*\/socket\.io\//)
    expect(normalizer.buildTargetUrl('/socket.io/?transport=websocket')).toBe(
      'https://example.com/api/v1/socket.io/?transport=websocket',
    )
  })

  it('falls back to the base pathname for root requests', () => {
    const normalizer = createProxyPathNormalizer('https://example.com/api')

    expect(normalizer.normalizeRequestUrl('/')).toBe('/api')
    expect(normalizer.buildTargetUrl('/')).toBe('https://example.com/api')
  })
})

describe('sanitizePathname', () => {
  it('normalizes empty and root paths to an empty string', () => {
    expect(sanitizePathname('')).toBe('')
    expect(sanitizePathname('/')).toBe('')
  })

  it('strips extra slashes while preserving significant segments', () => {
    expect(sanitizePathname('//api//v1/')).toBe('/api/v1')
  })
})
