// Service reachability checks. Browsers can't probe internal upstream IPs
// (CORS + private network), so Switchyard does it server-side.
//
// Status model:
//   up       — the upstream answered with a 2xx or a redirect: reachable.
//   degraded — the upstream answered, but with a 4xx/5xx: reachable but erroring.
//   down     — no HTTP response at all (connection refused / DNS / timeout).
//
// A health check measures *reachability*, not certificate trust. With
// HEALTH_CHECK_INSECURE_TLS=true (default) a self-signed or hostname-mismatched
// certificate on an HTTPS upstream — common for LAN services like Proxmox or
// OPNsense — does not count as "down": the server clearly answered. Traefik's
// own certificate policy for those backends is configured separately via a
// serversTransport.
const http = require('http')
const https = require('https')
const config = require('./config')
const store = require('./yamlStore')

let cache = {}
let lastCheckedAt = null
let timer = null

function checkUrl(url) {
  return new Promise((resolve) => {
    let parsed
    try {
      parsed = new URL(url)
    } catch (e) {
      return resolve({ url, status: 'down', statusCode: null, latencyMs: null, error: 'invalid URL' })
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return resolve({ url, status: 'down', statusCode: null, latencyMs: null, error: 'unsupported protocol' })
    }

    const lib = parsed.protocol === 'https:' ? https : http
    const started = Date.now()
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve({ url, ...result })
    }

    const req = lib.request(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Switchyard-HealthCheck' },
      // `rejectUnauthorized` is only consulted for HTTPS; harmless for HTTP.
      rejectUnauthorized: !config.health.insecureTls,
      timeout: config.health.timeoutMs,
    }, (res) => {
      const latencyMs = Date.now() - started
      res.resume() // drain the body so the socket is released
      const code = res.statusCode
      // 2xx and 3xx (a redirect — request() does not follow it) mean the server
      // answered normally; 4xx/5xx mean it answered with an error.
      const status = code >= 200 && code < 400 ? 'up' : 'degraded'
      finish({ status, statusCode: code || null, latencyMs, error: null })
    })

    req.on('timeout', () => { req.destroy(new Error('timeout')) })
    req.on('error', (e) => {
      finish({
        status: 'down',
        statusCode: null,
        latencyMs: null,
        error: (e && e.code) || (e && e.message) || 'error',
      })
    })
    req.end()
  })
}

async function checkServers(servers) {
  const results = await Promise.all((servers || []).map((s) => checkUrl(s.url)))

  let status
  if (results.length === 0) status = 'down'
  else if (results.every((r) => r.status === 'down')) status = 'down'
  else if (results.some((r) => r.status === 'down' || r.status === 'degraded')) status = 'degraded'
  else status = 'up'

  const latencies = results.filter((r) => r.latencyMs != null).map((r) => r.latencyMs)
  const latencyMs = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null

  return { status, latencyMs, checkedAt: new Date().toISOString(), servers: results }
}

// Re-check every service in the on-disk config.
async function checkAll() {
  let state
  try {
    state = await store.read()
  } catch (_) {
    return cache
  }
  const entries = await Promise.all(
    state.services.map(async (s) => [s.name, await checkServers(s.servers)]),
  )
  cache = Object.fromEntries(entries)
  lastCheckedAt = new Date().toISOString()
  return cache
}

// Re-check a single service. When `urls` are supplied (e.g. the user has
// edited URLs but not saved yet) they are checked directly; otherwise the
// service is looked up from the on-disk config.
async function checkOne(name, urls) {
  let servers
  if (Array.isArray(urls) && urls.length) {
    servers = urls.map((u) => ({ url: u }))
  } else {
    const state = await store.read()
    const svc = state.services.find((s) => s.name === name)
    servers = svc ? svc.servers : []
  }
  const result = await checkServers(servers)
  cache[name] = result
  lastCheckedAt = new Date().toISOString()
  return result
}

function snapshot() {
  return { services: cache, checkedAt: lastCheckedAt }
}

function start() {
  checkAll().catch(() => {})
  timer = setInterval(() => checkAll().catch(() => {}), config.health.intervalMs)
  if (timer.unref) timer.unref()
}

module.exports = { start, checkAll, checkOne, snapshot }
