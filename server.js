// Heads-Up Markets — local proxy server (zero dependencies, Node 20+).
// The G2 WebView may only call whitelisted origins and needs CORS headers,
// so the app talks ONLY to this server. This server calls CoinGecko and
// Polymarket server-side and adds `Access-Control-Allow-Origin: *`.
// No API keys anywhere: both upstream APIs are public and keyless.
// Serves the built app (dist/) too, so `node server.js` alone is enough
// for a local preview; the Vite dev server is only needed for hot reload.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT ?? 3000)
const DIST = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true'
const POLYMARKET_URL =
  'https://gamma-api.polymarket.com/markets?limit=10&active=true&order=volume24hr&ascending=false'

async function proxyJson(url, res) {
  try {
    const upstream = await fetch(url, { headers: { accept: 'application/json' } })
    const body = await upstream.text()
    res.writeHead(upstream.status, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    })
    res.end(body)
  } catch (err) {
    res.writeHead(502, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
    res.end(JSON.stringify({ error: 'upstream unavailable', detail: String(err) }))
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
      'access-control-max-age': '86400',
    })
    return res.end()
  }
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  if (url.pathname === '/api/prices') return proxyJson(COINGECKO_URL, res)
  if (url.pathname === '/api/markets') return proxyJson(POLYMARKET_URL, res)
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ ok: true }))
  }
  // Static: built app from dist/ (index.html fallback for SPA-less build).
  const rel = normalize(url.pathname === '/' ? 'index.html' : url.pathname.slice(1)).replace(/^(\.\.[/\\])+/, '')
  try {
    const data = await readFile(join(DIST, rel))
    res.writeHead(200, { 'content-type': MIME[extname(rel)] ?? 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found — run `npm run build` first')
  }
})

server.listen(PORT, () => {
  console.log(`Heads-Up Markets proxy on http://localhost:${PORT}`)
  console.log(`  GET /api/prices   -> CoinGecko (BTC/ETH/SOL)`)
  console.log(`  GET /api/markets  -> Polymarket Gamma (top 10 by 24h volume)`)
})
