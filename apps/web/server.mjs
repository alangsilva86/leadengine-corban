import http from 'http'
import handler from 'serve-handler'
import { URL } from 'node:url'
import httpProxy from 'http-proxy'

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

const resolveShouldProxy = (url) => {
  if (!proxyBaseUrl || typeof url !== 'string') return false

  return (
    url.startsWith('/api') ||
    url.startsWith('/socket.io') ||
    url === '/health' ||
    url.startsWith('/health?') ||
    url.startsWith('/health/')
  )
}

const buildProxyTarget = (url) => {
  if (!proxyBaseUrl) return null

  try {
    return new URL(url, proxyBaseUrl).toString()
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

    if (res && !res.headersSent) {
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

    console.error(`❌ ${message}`, {
      method: req?.method,
      url: req?.url,
      target: rawProxyTarget,
      reason: error?.message,
    })
  })
}

const server = http.createServer((req, res) => {
  if (req.url === '/_healthz' || req.url === '/_healthz.html') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    return res.end('ok')
  }

  if (proxyServer && resolveShouldProxy(req.url ?? '')) {
    const target = buildProxyTarget(req.url ?? '')
    if (target) {
      proxyServer.web(req, res, { target })
      return
    }
  }

  return handler(req, res, {
    public: 'dist',
    cleanUrls: true,
    rewrites: [{ source: '**', destination: '/index.html' }],
  })
})

if (proxyServer) {
  server.on('upgrade', (req, socket, head) => {
    if (!resolveShouldProxy(req.url ?? '')) {
      socket.destroy()
      return
    }

    const target = buildProxyTarget(req.url ?? '')
    if (!target) {
      socket.destroy()
      return
    }

    proxyServer.ws(req, socket, head, { target })
  })
}

server.listen(PORT, '0.0.0.0', () => {
  const proxyInfo = proxyBaseUrl ? ` (proxy → ${proxyBaseUrl.origin})` : ''
  console.log(`static server listening on :${PORT}${proxyInfo}`)
})
