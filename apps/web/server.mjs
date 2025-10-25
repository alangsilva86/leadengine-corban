import http from 'http'
import handler from 'serve-handler'
import { URL } from 'node:url'
import httpProxy from 'http-proxy'

import { createProxyPathNormalizer } from './server.proxy-helpers.mjs'

const parsedTimeout = Number(process.env.API_PROXY_HEALTH_TIMEOUT_MS ?? 5000)
const HEALTH_TIMEOUT_MS = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 5000

const normalizeStatus = (value, fallback = 'unknown') => {
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().toLowerCase()
  if (!normalized) return fallback

  if (['ok', 'healthy', 'up'].includes(normalized)) return 'ok'
  if (['down', 'unhealthy', 'error', 'fail', 'failing'].includes(normalized)) return 'unhealthy'

  return normalized
}

const parseJson = async (response) => {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => '')
    if (!text) return {}
    return { status: text, message: text }
  }

  return response.json().catch(() => ({}))
}

const resolveCandidateStatus = (payload) => {
  if (!payload) return null
  if (typeof payload === 'string') return payload

  if (typeof payload.status === 'string') return payload.status
  if (typeof payload.state === 'string') return payload.state
  if (typeof payload.health === 'string') return payload.health
  if (payload.success === true) return 'ok'

  return null
}

const respondJson = (res, statusCode, body) => {
  if (res.headersSent) return

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, max-age=0',
  })
  res.end(JSON.stringify(body))
}

const PORT = process.env.PORT || 8080
const rawProxyTarget = process.env.API_PROXY_TARGET || process.env.VITE_API_URL || ''

const parseProxyTarget = (value) => {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    return parsed
  } catch (error) {
    console.warn('⚠️  API proxy target is not a valid URL, proxy disabled', {
      reason: error?.message,
      value: value,
    })
    return null
  }
}

const proxyBaseUrl = parseProxyTarget(rawProxyTarget)
const proxyPathNormalizer = proxyBaseUrl ? createProxyPathNormalizer(proxyBaseUrl) : null
const proxyTargetOrigin = proxyPathNormalizer?.origin ?? null

const isHealthRequest = (url) => {
  if (typeof url !== 'string') return false

  return (
    url === '/health' ||
    url === '/healthz' ||
    url.startsWith('/health?') ||
    url.startsWith('/health/') ||
    url.startsWith('/healthz?') ||
    url.startsWith('/healthz/')
  )
}

const resolveShouldProxy = (url) => {
  if (!proxyBaseUrl || typeof url !== 'string') return false

  if (isHealthRequest(url)) return false

  return url.startsWith('/api') || url.startsWith('/socket.io')
}

const buildProxyTarget = (url) => {
  if (!proxyPathNormalizer) return null

  try {
    return proxyPathNormalizer.buildTargetUrl(url)
  } catch (error) {
    console.warn('⚠️  Failed to resolve proxy URL', { url, reason: error?.message })
    return null
  }
}

const proxyServer = proxyBaseUrl
  ? httpProxy.createProxyServer({
      changeOrigin: true,
      ws: true,
      secure: proxyBaseUrl.protocol === 'https:',
      xfwd: true,
    })
  : null

if (proxyServer) {
  proxyServer.on('error', (error, req, res) => {
    const message = 'API proxy request failed'

    const respondWithJson = () => {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: false,
          error: {
            code: 'API_PROXY_ERROR',
            message,
            details: error?.message ?? 'Unknown proxy error',
          },
        })
      )
    }

    if (res && typeof res.writeHead === 'function') {
      if (!res.headersSent) {
        respondWithJson()
      }
    } else if (res && typeof res.end === 'function') {
      res.end()
    } else if (res && typeof res.destroy === 'function') {
      res.destroy()
    } else if (req?.socket && !req.socket.destroyed) {
      try {
        req.socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n')
      } catch {
        req.socket.destroy()
      }
    }

    console.error(`❌ ${message}`, {
      method: req?.method,
      url: req?.url,
      target: rawProxyTarget,
      reason: error?.message,
    })
  })
}

const resolveHealthTarget = (url) => {
  if (!proxyBaseUrl) return null

  const parsed = (() => {
    try {
      return new URL(url ?? '/health', 'http://localhost')
    } catch {
      return new URL('/health', 'http://localhost')
    }
  })()

  const pathname = parsed.pathname === '/healthz' ? '/healthz' : '/health'

  return buildProxyTarget(`${pathname}${parsed.search}`)
}

const handleHealthRequest = async (req, res) => {
  const startedAt = Date.now()

  if (!proxyBaseUrl) {
    respondJson(res, 200, {
      success: true,
      status: 'unknown',
      source: 'static-server',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      details: {
        reason: 'API proxy target is not configured',
      },
    })
    return
  }

  const target = resolveHealthTarget(req.url)

  if (!target) {
    respondJson(res, 200, {
      success: true,
      status: 'unknown',
      source: 'static-server',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      details: {
        reason: 'Failed to resolve upstream health URL',
        request: req.url ?? null,
      },
    })
    return
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)

  try {
    const upstreamResponse = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    const payload = await parseJson(upstreamResponse)
    const candidateStatus = resolveCandidateStatus(payload)
    const status = normalizeStatus(candidateStatus ?? (upstreamResponse.ok ? 'ok' : 'unhealthy'))

    respondJson(res, 200, {
      success: true,
      status,
      source: 'api-proxy',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      upstream: {
        url: target,
        status: upstreamResponse.status,
        ok: upstreamResponse.ok,
        headers: Object.fromEntries(upstreamResponse.headers.entries()),
        payload,
      },
    })
  } catch (error) {
    respondJson(res, 200, {
      success: true,
      status: 'unhealthy',
      source: 'api-proxy',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      upstream: {
        url: target,
        ok: false,
        error: error?.message ?? 'Unknown proxy failure',
        aborted: error?.name === 'AbortError',
        timeoutMs: HEALTH_TIMEOUT_MS,
      },
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

const server = http.createServer((req, res) => {
  const processRequest = async () => {
    if (req.url === '/_healthz' || req.url === '/_healthz.html') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }

    if (isHealthRequest(req.url ?? '')) {
      await handleHealthRequest(req, res)
      return
    }

    if (proxyServer && proxyPathNormalizer && resolveShouldProxy(req.url ?? '')) {
      const normalizedUrl = proxyPathNormalizer.normalizeRequestUrl(req.url ?? '')
      if (normalizedUrl && proxyTargetOrigin) {
        req.url = normalizedUrl
        proxyServer.web(req, res, { target: proxyTargetOrigin, prependPath: false })
        return
      }
    }

    handler(req, res, {
      public: 'dist',
      cleanUrls: true,
      rewrites: [{ source: '**', destination: '/index.html' }],
    })
  }

  processRequest().catch((error) => {
    console.error('❌ Unexpected server error', error)
    respondJson(res, 500, {
      success: false,
      error: {
        code: 'STATIC_SERVER_ERROR',
        message: 'Unexpected static server error',
        details: error?.message ?? 'Unknown error',
      },
    })
  })
})

if (proxyServer && proxyPathNormalizer) {
  server.on('upgrade', (req, socket, head) => {
    if (!resolveShouldProxy(req.url ?? '')) {
      socket.destroy()
      return
    }

    const normalizedUrl = proxyPathNormalizer.normalizeRequestUrl(req.url ?? '')
    if (!normalizedUrl || !proxyTargetOrigin) {
      socket.destroy()
      return
    }

    req.url = normalizedUrl
    proxyServer.ws(req, socket, head, { target: proxyTargetOrigin, prependPath: false })
  })
}

server.listen(PORT, '0.0.0.0', () => {
  const proxyInfo = proxyBaseUrl ? ` (proxy → ${proxyBaseUrl.origin})` : ''
  console.log(`static server listening on :${PORT}${proxyInfo}`)
})
