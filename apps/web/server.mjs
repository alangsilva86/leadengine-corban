import http from 'http'
import handler from 'serve-handler'

const PORT = process.env.PORT || 8080

const server = http.createServer((req, res) => {
  if (req.url === '/_healthz' || req.url === '/_healthz.html') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    return res.end('ok')
  }

  return handler(req, res, {
    public: 'dist',
    cleanUrls: true,
    rewrites: [{ source: '**', destination: '/index.html' }],
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`static server listening on :${PORT}`)
})
