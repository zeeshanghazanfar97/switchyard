// Reads and writes the Traefik dynamic config file, translating between the
// Traefik YAML shape and the flat shape the editor UI works with.
const fs = require('fs/promises')
const path = require('path')
const yaml = require('js-yaml')
const config = require('./config')

// Disabled routers/services are written as a fenced, commented-out block at the
// end of the file. Traefik ignores the comments; Switchyard re-reads them so a
// disabled entry's definition survives until it is re-enabled.
const DISABLED_START = '# --- switchyard:disabled (managed by Switchyard — do not edit) ---'
const DISABLED_END = '# --- switchyard:end ---'

// ── Traefik YAML  ->  editor state ──────────────────────────────────────────
// The entity `id` is the YAML key at load time. It stays stable for the life
// of an editing session even if the user renames the entity, so the UI can
// keep tracking the same row; the file is always keyed by `name` on write.
function fromTraefik(doc) {
  const http = (doc && doc.http) || {}

  const routers = Object.entries(http.routers || {}).map(([name, r]) => {
    const router = r || {}
    return {
      id: name,
      name,
      rule: router.rule || '',
      entryPoints: Array.isArray(router.entryPoints) ? router.entryPoints.slice() : [],
      service: router.service || '',
      middlewares: Array.isArray(router.middlewares) ? router.middlewares.slice() : [],
      priority: router.priority != null ? router.priority : null,
      tls: router.tls ? { ...router.tls } : null,
    }
  })

  const services = Object.entries(http.services || {}).map(([name, s]) => {
    const svc = s || {}
    const type = Object.keys(svc)[0] || 'loadBalancer'
    const body = svc[type] || {}
    return {
      id: name,
      name,
      type,
      servers: Array.isArray(body.servers) ? body.servers.map((sv) => ({ ...sv })) : [],
      passHostHeader: body.passHostHeader != null ? body.passHostHeader : null,
      sticky: body.sticky || null,
      serversTransport: body.serversTransport || null,
    }
  })

  const middlewares = Object.entries(http.middlewares || {}).map(([name, m]) => {
    const mw = m || {}
    const type = Object.keys(mw)[0] || 'headers'
    return { id: name, name, type, config: mw[type] || {} }
  })

  const serversTransports = Object.entries(http.serversTransports || {}).map(([name, st]) => ({
    id: name,
    name,
    config: st && typeof st === 'object' ? { ...st } : {},
  }))

  return { routers, services, middlewares, serversTransports }
}

// ── editor state  ->  Traefik YAML ──────────────────────────────────────────
function toTraefik(state) {
  const http = {}

  const routers = state.routers || []
  if (routers.length) {
    http.routers = {}
    for (const r of routers) {
      const node = {
        rule: r.rule || '',
        entryPoints: r.entryPoints || [],
        service: r.service || '',
      }
      if (r.middlewares && r.middlewares.length) node.middlewares = r.middlewares
      if (r.priority != null) node.priority = r.priority
      if (r.tls) node.tls = r.tls
      http.routers[r.name] = node
    }
  }

  const services = state.services || []
  if (services.length) {
    http.services = {}
    for (const s of services) {
      const body = {}
      if (s.serversTransport) body.serversTransport = s.serversTransport
      if (s.passHostHeader != null) body.passHostHeader = s.passHostHeader
      body.servers = s.servers || []
      if (s.sticky) body.sticky = typeof s.sticky === 'object' ? s.sticky : { cookie: {} }
      http.services[s.name] = { [s.type || 'loadBalancer']: body }
    }
  }

  const middlewares = state.middlewares || []
  if (middlewares.length) {
    http.middlewares = {}
    for (const m of middlewares) {
      http.middlewares[m.name] = { [m.type]: m.config || {} }
    }
  }

  const serversTransports = state.serversTransports || []
  if (serversTransports.length) {
    http.serversTransports = {}
    for (const st of serversTransports) {
      http.serversTransports[st.name] = st.config || {}
    }
  }

  return { http }
}

function commentBlock(text) {
  return text.split('\n').map((line) => (line.length ? `# ${line}` : '#')).join('\n')
}

// Recover the disabled routers/services from the fenced comment block, if any.
function extractDisabled(rawText) {
  const lines = rawText.split('\n')
  const startIdx = lines.findIndex((l) => l.trim() === DISABLED_START)
  if (startIdx === -1) return { routers: [], services: [] }
  const endIdx = lines.findIndex((l, i) => i > startIdx && l.trim() === DISABLED_END)
  if (endIdx === -1) return { routers: [], services: [] }

  const inner = lines.slice(startIdx + 1, endIdx).map((l) => l.replace(/^#[ ]?/, '')).join('\n')
  let frag
  try {
    frag = yaml.load(inner) || {}
  } catch (e) {
    return { routers: [], services: [] }
  }
  const parsed = fromTraefik({ http: frag })
  return { routers: parsed.routers, services: parsed.services }
}

// Parse raw config text into editor state, recovering disabled entries and
// tagging every router/service with an `enabled` flag.
function parseConfig(rawText) {
  const active = fromTraefik(yaml.load(rawText) || {})
  const disabled = extractDisabled(rawText)

  for (const r of active.routers) r.enabled = true
  for (const s of active.services) s.enabled = true
  for (const r of disabled.routers) r.enabled = false
  for (const s of disabled.services) s.enabled = false

  return {
    routers: [...active.routers, ...disabled.routers],
    services: [...active.services, ...disabled.services],
    middlewares: active.middlewares,
    serversTransports: active.serversTransports,
  }
}

async function readRaw() {
  try {
    return await fs.readFile(config.dynamicFile, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return ''
    throw e
  }
}

async function read() {
  let text
  let stat
  try {
    text = await fs.readFile(config.dynamicFile, 'utf8')
    stat = await fs.stat(config.dynamicFile)
  } catch (e) {
    if (e.code === 'ENOENT') {
      return {
        routers: [],
        services: [],
        middlewares: [],
        serversTransports: [],
        meta: { file: config.dynamicFile, lastModified: null, exists: false },
      }
    }
    throw e
  }
  const state = parseConfig(text)
  state.meta = {
    file: config.dynamicFile,
    lastModified: stat.mtime.toISOString(),
    exists: true,
  }
  return state
}

// Writes atomically: render to a temp file in the same directory, then rename
// over the target so Traefik never sees a half-written file. Disabled routers
// and services are appended as a commented-out block.
async function write(state) {
  const routers = state.routers || []
  const services = state.services || []
  const enabledRouters = routers.filter((r) => r.enabled !== false)
  const enabledServices = services.filter((s) => s.enabled !== false)
  const disabledRouters = routers.filter((r) => r.enabled === false)
  const disabledServices = services.filter((s) => s.enabled === false)

  const dumpOpts = { lineWidth: -1, noRefs: true, sortKeys: false }
  const activeDoc = toTraefik({
    routers: enabledRouters,
    services: enabledServices,
    middlewares: state.middlewares,
    serversTransports: state.serversTransports,
  })
  let text = yaml.dump(activeDoc, dumpOpts)

  if (disabledRouters.length || disabledServices.length) {
    const frag = toTraefik({ routers: disabledRouters, services: disabledServices }).http
    const fragText = yaml.dump(frag, dumpOpts).replace(/\n$/, '')
    text += `\n${DISABLED_START}\n${commentBlock(fragText)}\n${DISABLED_END}\n`
  }

  const file = config.dynamicFile
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp, text, 'utf8')
  await fs.rename(tmp, file)
  return text
}

module.exports = { fromTraefik, toTraefik, parseConfig, read, readRaw, write }
