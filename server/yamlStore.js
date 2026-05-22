// Reads and writes the Traefik dynamic config file, translating between the
// Traefik YAML shape and the flat shape the editor UI works with.
const fs = require('fs/promises')
const path = require('path')
const yaml = require('js-yaml')
const config = require('./config')

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
    }
  })

  const middlewares = Object.entries(http.middlewares || {}).map(([name, m]) => {
    const mw = m || {}
    const type = Object.keys(mw)[0] || 'headers'
    return {
      id: name,
      name,
      type,
      config: mw[type] || {},
    }
  })

  return { routers, services, middlewares }
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
      const body = { servers: s.servers || [] }
      if (s.passHostHeader != null) body.passHostHeader = s.passHostHeader
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

  return { http }
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
        meta: { file: config.dynamicFile, lastModified: null, exists: false },
      }
    }
    throw e
  }
  const doc = yaml.load(text) || {}
  const state = fromTraefik(doc)
  state.meta = {
    file: config.dynamicFile,
    lastModified: stat.mtime.toISOString(),
    exists: true,
  }
  return state
}

// Writes atomically: render to a temp file in the same directory, then rename
// over the target so Traefik never sees a half-written file.
async function write(state) {
  const doc = toTraefik(state)
  const text = yaml.dump(doc, { lineWidth: -1, noRefs: true, sortKeys: false })
  const file = config.dynamicFile
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp, text, 'utf8')
  await fs.rename(tmp, file)
  return text
}

module.exports = { fromTraefik, toTraefik, read, readRaw, write }
