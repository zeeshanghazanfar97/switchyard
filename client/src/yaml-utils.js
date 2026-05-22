// Minimal YAML serializer tuned for the Traefik dynamic config shape, used for
// the live previews in the editor and the Raw YAML screen. The server uses a
// full YAML library (js-yaml) for the actual file writes.

const INDENT = '  '

// Fences for the commented-out block of disabled routers/services.
// Must match server/yamlStore.js.
const DISABLED_START = '# --- switchyard:disabled (managed by Switchyard — do not edit) ---'
const DISABLED_END = '# --- switchyard:end ---'

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

// Quote strings that need it (contain special chars, look like numbers, etc.)
function fmtScalar(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  const s = String(v)
  // Traefik rules contain backticks/parens; quote them.
  const needsQuote = /[:#&*!|>'"%@`,\[\]{}?]/.test(s) || /^\s|\s$/.test(s) || s === '' || /^(true|false|null|yes|no)$/i.test(s) || /^-?\d/.test(s)
  if (needsQuote) {
    const esc = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `"${esc}"`
  }
  return s
}

function stringify(value, depth = 0) {
  const pad = INDENT.repeat(depth)
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return fmtScalar(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return value.map((item) => {
      if (isPlainObject(item) || Array.isArray(item)) {
        const inner = stringify(item, depth + 1).trimStart()
        // First key on the dash line, rest indented
        const lines = inner.split('\n')
        return `${pad}- ${lines[0]}\n${lines.slice(1).map((l) => INDENT + l).join('\n')}`.replace(/\n$/, '')
      }
      return `${pad}- ${fmtScalar(item)}`
    }).join('\n')
  }
  // object
  const keys = Object.keys(value)
  if (keys.length === 0) return '{}'
  return keys.map((k) => {
    const v = value[k]
    if (isPlainObject(v)) {
      if (Object.keys(v).length === 0) return `${pad}${k}: {}`
      return `${pad}${k}:\n${stringify(v, depth + 1)}`
    }
    if (Array.isArray(v)) {
      if (v.length === 0) return `${pad}${k}: []`
      return `${pad}${k}:\n${stringify(v, depth + 1)}`
    }
    return `${pad}${k}: ${fmtScalar(v)}`
  }).join('\n')
}

function serviceBody(s) {
  const lb = {}
  if (s.serversTransport) lb.serversTransport = s.serversTransport
  if (s.passHostHeader != null) lb.passHostHeader = s.passHostHeader
  lb.servers = s.servers
  if (s.sticky) lb.sticky = typeof s.sticky === 'object' ? s.sticky : { cookie: {} }
  return { [s.type]: lb }
}

function routerBody(r) {
  const node = { rule: r.rule, entryPoints: r.entryPoints, service: r.service }
  if (r.middlewares && r.middlewares.length) node.middlewares = r.middlewares
  if (r.priority != null) node.priority = r.priority
  if (r.tls) node.tls = r.tls
  return node
}

// Assembles the `http` object from a set of routers/services and the full
// middleware + transport collections.
function buildHttp(routers, services, middlewares, serversTransports) {
  const http = {}
  if (routers.length) {
    http.routers = {}
    for (const r of routers) http.routers[r.name] = routerBody(r)
  }
  if (services.length) {
    http.services = {}
    for (const s of services) http.services[s.name] = serviceBody(s)
  }
  if (middlewares && middlewares.length) {
    http.middlewares = {}
    for (const m of middlewares) http.middlewares[m.name] = { [m.type]: m.config }
  }
  if (serversTransports && serversTransports.length) {
    http.serversTransports = {}
    for (const st of serversTransports) http.serversTransports[st.name] = st.config || {}
  }
  return http
}

function buildFullConfig(state) {
  const enabledRouters = state.routers.filter((r) => r.enabled !== false)
  const enabledServices = state.services.filter((s) => s.enabled !== false)
  const disabledRouters = state.routers.filter((r) => r.enabled === false)
  const disabledServices = state.services.filter((s) => s.enabled === false)

  let text = stringify({
    http: buildHttp(enabledRouters, enabledServices, state.middlewares, state.serversTransports),
  }, 0)

  if (disabledRouters.length || disabledServices.length) {
    const frag = buildHttp(disabledRouters, disabledServices, [], [])
    const commented = stringify(frag, 0).split('\n')
      .map((l) => (l.length ? `# ${l}` : '#')).join('\n')
    text += `\n\n${DISABLED_START}\n${commented}\n${DISABLED_END}\n`
  }
  return text
}

function buildRouterSnippet(r) {
  return stringify({ [r.name]: routerBody(r) }, 0)
}

function buildServiceSnippet(s) {
  return stringify({ [s.name]: serviceBody(s) }, 0)
}

function buildMiddlewareSnippet(m) {
  return stringify({ [m.name]: { [m.type]: m.config } }, 0)
}

function buildTransportSnippet(st) {
  return stringify({ [st.name]: st.config || {} }, 0)
}

export const Yaml = {
  stringify,
  buildFullConfig,
  buildRouterSnippet,
  buildServiceSnippet,
  buildMiddlewareSnippet,
  buildTransportSnippet,
}

// Human-readable relative time. Returns "never" for a missing timestamp.
export function timeAgo(iso) {
  if (!iso) return 'never'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return `${Math.round(s)}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}
