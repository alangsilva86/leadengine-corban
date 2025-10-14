export const sanitizePathname = (value) => {
  if (typeof value !== 'string') return ''

  const trimmed = value.trim()
  if (!trimmed || trimmed === '/') return ''

  const segments = trimmed.split('/').filter(Boolean)
  if (segments.length === 0) return ''

  return `/${segments.join('/')}`
}

const parseRelativeUrl = (value) => {
  try {
    return new URL(value ?? '/', 'http://localhost')
  } catch {
    return new URL('/', 'http://localhost')
  }
}

const normalizeIncomingPathname = (pathname) => {
  if (typeof pathname !== 'string' || pathname === '') return '/'

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return '/'

  const joined = `/${segments.join('/')}`
  const hasTrailingSlash = pathname.endsWith('/')

  return hasTrailingSlash ? `${joined}/` : joined
}

export const createProxyPathNormalizer = (proxyUrl) => {
  if (!proxyUrl) return null

  const url = proxyUrl instanceof URL ? proxyUrl : new URL(proxyUrl)
  const origin = url.origin
  const basePathname = sanitizePathname(url.pathname)

  const normalizeRequestUrl = (incoming) => {
    const parsed = parseRelativeUrl(incoming)
    let pathname = normalizeIncomingPathname(parsed.pathname)

    if (!pathname || pathname === '/') {
      pathname = basePathname || '/'
    } else if (basePathname) {
      const alreadyPrefixed =
        pathname === basePathname ||
        pathname === `${basePathname}/` ||
        pathname.startsWith(`${basePathname}/`)

      if (!alreadyPrefixed) {
        const trailingSlash = pathname.endsWith('/')
        const trimmed = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
        pathname = `${basePathname}/${trimmed}`
        if (trailingSlash) pathname = `${pathname}/`
      }
    }

    if (!pathname.startsWith('/')) {
      pathname = `/${pathname}`
    }

    return `${pathname}${parsed.search}${parsed.hash}`
  }

  const buildTargetUrl = (incoming) => {
    return `${origin}${normalizeRequestUrl(incoming)}`
  }

  return {
    origin,
    basePathname,
    normalizeRequestUrl,
    buildTargetUrl,
  }
}
