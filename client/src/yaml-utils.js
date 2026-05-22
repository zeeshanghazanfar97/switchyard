// Minimal YAML serializer tuned for the Traefik dynamic config shape, used for
// the live previews in the editor and the Raw YAML screen. The server uses a
// full YAML library (js-yaml) for the actual file writes.

const INDENT = '  '

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

function buildFullConfig(state) {
  const out = { http: {} }

  if (state.routers.length) {
    out.http.routers = {}
    for (const r of state.routers) {
      const node = {
        rule: r.rule,
        entryPoints: r.entryPoints,
        service: r.service,
      }
      if (r.middlewares && r.middlewares.length) node.middlewares = r.middlewares
      if (r.priority != null) node.priority = r.priority
      if (r.tls) node.tls = r.tls
      out.http.routers[r.name] = node
    }
  }
  if (state.services.length) {
    out.http.services = {}
    for (const s of state.services) {
      out.http.services[s.name] = {
        [s.type]: {
          servers: s.servers,
          ...(s.passHostHeader != null ? { passHostHeader: s.passHostHeader } : {}),
          ...(s.sticky ? { sticky: typeof s.sticky === 'object' ? s.sticky : { cookie: {} } } : {}),
        },
      }
    }
  }
  if (state.middlewares.length) {
    out.http.middlewares = {}
    for (const m of state.middlewares) {
      out.http.middlewares[m.name] = { [m.type]: m.config }
    }
  }
  return stringify(out, 0)
}

function buildRouterSnippet(r) {
  const node = {
    [r.name]: {
      rule: r.rule,
      entryPoints: r.entryPoints,
      service: r.service,
      ...(r.middlewares && r.middlewares.length ? { middlewares: r.middlewares } : {}),
      ...(r.priority != null ? { priority: r.priority } : {}),
      ...(r.tls ? { tls: r.tls } : {}),
    },
  }
  return stringify(node, 0)
}

function buildServiceSnippet(s) {
  const node = {
    [s.name]: {
      [s.type]: {
        servers: s.servers,
        ...(s.passHostHeader != null ? { passHostHeader: s.passHostHeader } : {}),
        ...(s.sticky ? { sticky: typeof s.sticky === 'object' ? s.sticky : { cookie: {} } } : {}),
      },
    },
  }
  return stringify(node, 0)
}

function buildMiddlewareSnippet(m) {
  const node = { [m.name]: { [m.type]: m.config } }
  return stringify(node, 0)
}

export const Yaml = {
  stringify,
  buildFullConfig,
  buildRouterSnippet,
  buildServiceSnippet,
  buildMiddlewareSnippet,
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
