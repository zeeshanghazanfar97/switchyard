// Service reachability checks. Browsers can't probe internal upstream IPs
// (CORS + private network), so Switchyard does it server-side.
//
// Status model:
//   up       — the upstream answered with a 2xx (or a redirect): reachable.
//   degraded — the upstream answered, but with a 4xx/5xx: reachable but erroring.
//   down     — no HTTP response at all (connection refused / DNS / timeout).
const config = require('./config')
const store = require('./yamlStore')

let cache = {}
let lastCheckedAt = null
let timer = null

async function checkUrl(url) {
  const started = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.health.timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'Switchyard-HealthCheck' },
    })
    const latencyMs = Date.now() - started
    // Discard the body — we only need the response line.
    try { if (res.body) await res.body.cancel() } catch (_) { /* ignore */ }

    const code = res.status
    let status
    if (res.type === 'opaqueredirect' || (code >= 300 && code < 400)) status = 'up'
    else if (code >= 200 && code < 300) status = 'up'
    else status = 'degraded'
    return { url, status, statusCode: code || null, latencyMs, error: null }
  } catch (e) {
    const reason =
      e.name === 'AbortError' ? 'timeout'
      : e.cause && e.cause.code ? e.cause.code
      : e.message
    return { url, status: 'down', statusCode: null, latencyMs: null, error: reason }
  } finally {
    clearTimeout(timeout)
  }
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
