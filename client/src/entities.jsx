// Routers, Services, Middlewares and Transports views.
// All follow the same SplitPane (list | editor) pattern using primitives.
import React from 'react'
import { Icon } from './icons.jsx'
import { Yaml, timeAgo } from './yaml-utils.js'
import {
  SplitPane, ListPane, ListRow, EditorShell, Section, Field, TagInput, YamlPreview, Spinner,
} from './primitives.jsx'

// ── shared ────────────────────────────────────────────────────────────────
const COMMON_ENTRYPOINTS = ['web', 'websecure', 'metrics', 'traefik']
const COMMON_RESOLVERS = ['cloudflare', 'letsencrypt', 'letsencrypt-staging']

const MIDDLEWARE_TYPES = [
  { value: 'forwardAuth', label: 'forwardAuth', desc: 'Delegate auth to an upstream URL' },
  { value: 'headers', label: 'headers', desc: 'Add/remove response & request headers' },
  { value: 'rateLimit', label: 'rateLimit', desc: 'Token-bucket request rate limiter' },
  { value: 'stripPrefix', label: 'stripPrefix', desc: 'Strip URL prefix before forwarding' },
  { value: 'addPrefix', label: 'addPrefix', desc: 'Add URL prefix before forwarding' },
  { value: 'basicAuth', label: 'basicAuth', desc: 'HTTP basic auth (htpasswd)' },
  { value: 'ipAllowList', label: 'ipAllowList', desc: 'Restrict by source IP/CIDR' },
  { value: 'compress', label: 'compress', desc: 'gzip/brotli response compression' },
  { value: 'retry', label: 'retry', desc: 'Retry on failed backends' },
  { value: 'redirectScheme', label: 'redirectScheme', desc: 'Redirect http → https etc.' },
]

function defaultMiddlewareConfig(type) {
  switch (type) {
    case 'forwardAuth': return { address: 'http://auth:9000/check', trustForwardHeader: true, authResponseHeaders: [] }
    case 'headers': return { browserXssFilter: true, contentTypeNosniff: true, frameDeny: true, sslRedirect: true }
    case 'rateLimit': return { average: 100, burst: 50 }
    case 'stripPrefix': return { prefixes: ['/api'] }
    case 'addPrefix': return { prefix: '/api' }
    case 'basicAuth': return { users: [] }
    case 'ipAllowList': return { sourceRange: ['10.0.0.0/8'] }
    case 'compress': return {}
    case 'retry': return { attempts: 3, initialInterval: '100ms' }
    case 'redirectScheme': return { scheme: 'https', permanent: true }
    default: return {}
  }
}

// Generates an entity id that doesn't collide with existing ones.
function freshId(prefix, items) {
  const taken = new Set(items.map((x) => x.id))
  let n = items.length + 1
  while (taken.has(`${prefix}-${n}`)) n++
  return `${prefix}-${n}`
}

const isEnabled = (e) => e.enabled !== false

// Health lookups against the live health map keyed by service name.
function healthOf(health, name) {
  return (health && health[name]) || null
}
function statusOf(health, name) {
  const h = health && health[name]
  return (h && h.status) || 'unknown'
}

function HealthDot({ status, withLabel, latencyMs }) {
  const palette = {
    up: { color: 'var(--ok)', soft: 'var(--ok-soft)', label: 'healthy' },
    degraded: { color: 'var(--warn)', soft: 'var(--warn-soft)', label: 'degraded' },
    down: { color: 'var(--bad)', soft: 'var(--bad-soft)', label: 'unreachable' },
  }
  const m = palette[status] || { color: 'var(--faint)', soft: 'transparent', label: 'checking…' }
  const pulse = status === 'degraded' || status === 'down'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: m.color, fontSize: 11, fontWeight: 500 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: 'currentColor',
        boxShadow: `0 0 0 3px ${m.soft}`,
        animation: pulse ? 'pulse-dot 1.4s ease-in-out infinite' : null,
      }} />
      {withLabel && (
        <>
          {m.label}
          {latencyMs != null && <span className="mono" style={{ color: 'var(--muted)' }}>· {latencyMs}ms</span>}
        </>
      )}
    </span>
  )
}

// Small "off" badge for disabled entities in list rows.
function OffPill() {
  return <span className="pill" style={{ height: 18, padding: '0 5px', fontSize: 10 }}>off</span>
}

// Editor toggle button for enabling/disabling an entity.
function EnableButton({ entity, onToggle }) {
  return (
    <button className="btn ghost sm" onClick={() => onToggle(entity)}>
      <Icon name="power" size={13} /> {isEnabled(entity) ? 'Disable' : 'Enable'}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ROUTERS
// ════════════════════════════════════════════════════════════════════════════
export function RoutersView({ state, setState, selectedId, setSelectedId, health, onSave, saving, openEntity }) {
  const [search, setSearch] = React.useState('')
  const filtered = state.routers.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.rule.toLowerCase().includes(search.toLowerCase()),
  )

  React.useEffect(() => {
    if (!state.routers.find((r) => r.id === selectedId) && state.routers.length) {
      setSelectedId(state.routers[0].id)
    }
  }, [state.routers, selectedId])

  const current = state.routers.find((r) => r.id === selectedId)
  const update = (patch) => {
    setState((s) => ({
      ...s,
      routers: s.routers.map((r) => (r.id === selectedId ? { ...r, ...patch } : r)),
    }))
  }
  const add = () => {
    const id = freshId('router', state.routers)
    const fresh = {
      id, name: id, rule: 'Host(`new.example.com`)',
      entryPoints: ['websecure'], service: state.services[0]?.name || '',
      middlewares: [], tls: { certResolver: 'cloudflare' }, priority: null, enabled: true,
    }
    setState((s) => ({ ...s, routers: [...s.routers, fresh] }))
    setSelectedId(id)
  }
  const remove = () => {
    setState((s) => ({ ...s, routers: s.routers.filter((r) => r.id !== selectedId) }))
  }
  const toggleEnabled = (r) => {
    setState((s) => ({ ...s, routers: s.routers.map((x) => (x.id === r.id ? { ...x, enabled: x.enabled === false } : x)) }))
  }

  return (
    <SplitPane>
      <ListPane
        title="Routers"
        count={state.routers.length}
        search={search} setSearch={setSearch}
        onAdd={add} addLabel="New router"
        footer={`${state.routers.length} total · ${state.routers.filter((r) => isEnabled(r)).length} enabled`}
      >
        {filtered.map((r) => {
          const svc = state.services.find((s) => s.name === r.service)
          return (
            <ListRow
              key={r.id}
              active={r.id === selectedId}
              dimmed={!isEnabled(r)}
              onClick={() => setSelectedId(r.id)}
              icon={<Icon name="router" size={14} />}
              label={r.name}
              sub={r.rule.replace(/`/g, '')}
              status={
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {!isEnabled(r) && <OffPill />}
                  {r.tls && <span className="pill accent" title="TLS enabled" style={{ height: 18, padding: '0 5px', fontSize: 10 }}>TLS</span>}
                  {svc && isEnabled(r) && <HealthDot status={statusOf(health, svc.name)} />}
                </span>
              }
            />
          )
        })}
        {filtered.length === 0 && (
          <div className="empty" style={{ padding: 32 }}>
            <Icon name="search" size={20} style={{ color: 'var(--faint)' }} />
            <div>No routers match "{search}"</div>
          </div>
        )}
      </ListPane>

      {current
        ? <RouterEditor router={current} state={state} update={update} remove={remove}
                        health={health} onSave={onSave} saving={saving} openEntity={openEntity}
                        onToggleEnabled={toggleEnabled} />
        : <EditorEmpty icon="router" label="router" onAdd={add} />}
    </SplitPane>
  )
}

function RouterEditor({ router, state, update, remove, health, onSave, saving, openEntity, onToggleEnabled }) {
  const [dragOver, setDragOver] = React.useState(false)
  const disabled = !isEnabled(router)

  const issues = []
  if (disabled) issues.push({ level: 'info', message: 'This router is disabled — commented out in dynamic.yml and ignored by Traefik.' })
  const targetService = state.services.find((s) => s.name === router.service)
  if (!targetService) issues.push({ level: 'error', message: `Service "${router.service}" does not exist.` })
  else if (!disabled && !isEnabled(targetService)) issues.push({ level: 'error', message: `Target service "${targetService.name}" is disabled.` })
  else if (!disabled && statusOf(health, targetService.name) === 'down') issues.push({ level: 'warn', message: `Target service "${targetService.name}" is unreachable.` })
  if (!router.rule.trim()) issues.push({ level: 'error', message: 'Rule cannot be empty.' })
  for (const m of router.middlewares || []) {
    if (!state.middlewares.find((mw) => mw.name === m)) {
      issues.push({ level: 'error', message: `Middleware "${m}" not defined.` })
    }
  }

  const snippet = Yaml.buildRouterSnippet(router)

  const onDropMiddleware = (e) => {
    e.preventDefault()
    const name = e.dataTransfer.getData('text/middleware')
    if (name && !router.middlewares.includes(name)) {
      update({ middlewares: [...router.middlewares, name] })
    }
    setDragOver(false)
  }

  return (
    <EditorShell
      kind="router"
      breadcrumbs={['http', 'routers']}
      name={router.name}
      namePill={
        <span style={{ display: 'flex', gap: 6 }}>
          {disabled && <span className="pill">disabled</span>}
          {router.tls && <span className="pill accent">TLS</span>}
          {targetService && !disabled && <HealthDot status={statusOf(health, targetService.name)} withLabel latencyMs={healthOf(health, targetService.name)?.latencyMs} />}
        </span>
      }
      actions={
        <>
          <EnableButton entity={router} onToggle={onToggleEnabled} />
          <button className="btn ghost sm danger" onClick={() => { if (confirm(`Delete router "${router.name}"?`)) remove() }}>
            <Icon name="trash" size={13} /> Delete
          </button>
          <button className="btn primary sm" onClick={onSave} disabled={saving}>
            {saving ? <Spinner dark /> : <><Icon name="save" size={13} /> Save changes</>}
          </button>
        </>
      }
      validationIssues={issues}
      footer={
        <>
          <span><Icon name="history" size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Last saved {timeAgo(state.meta?.lastModified)}{state.meta?.lastModifiedBy ? ` by ${state.meta.lastModifiedBy}` : ''}</span>
          <span className="mono">{state.meta?.file} → http.routers.{router.name}</span>
        </>
      }
    >
      <Section title="Identity">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
          <Field label="Name" hint="Used as the router key in YAML. Must be unique." htmlFor="r-name">
            <input id="r-name" className="input mono" value={router.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Priority" hint="Higher wins on ties.">
            <input className="input mono" type="number" placeholder="—" value={router.priority ?? ''} onChange={(e) => update({ priority: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
        </div>
      </Section>

      <Section title="Matching rule" hint="Traefik Host(), PathPrefix(), Headers(), etc.">
        <Field label="Rule" htmlFor="r-rule" hint="Use backticks around values. Combine with && or ||.">
          <textarea id="r-rule" className="textarea" rows={2} value={router.rule} onChange={(e) => update({ rule: e.target.value })} />
        </Field>
        <Field label="Entry points" hint="Listeners that this rule applies to.">
          <TagInput value={router.entryPoints} onChange={(v) => update({ entryPoints: v })}
                    placeholder="websecure, web…" suggestions={COMMON_ENTRYPOINTS} />
        </Field>
      </Section>

      <Section title="Service" hint="Backend that handles matched requests."
        action={
          targetService && (
            <button className="btn ghost sm" onClick={() => openEntity('services', targetService.id)}>
              Open service →
            </button>
          )
        }>
        <Field label="Target service">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="input mono" value={router.service} onChange={(e) => update({ service: e.target.value })} style={{ flex: 1 }}>
              <option value="">— select —</option>
              {state.services.map((s) => (
                <option key={s.id} value={s.name}>{s.name} ({s.servers.length} server{s.servers.length === 1 ? '' : 's'}){isEnabled(s) ? '' : ' — disabled'}</option>
              ))}
            </select>
            {targetService && targetService.servers[0] && (
              <span className="pill mono" title="Primary upstream">
                <Icon name="server" size={11} /> {targetService.servers[0].url}
              </span>
            )}
          </div>
        </Field>
      </Section>

      <Section title="Middlewares" hint="Drag from the palette below to attach. Order matters: top runs first.">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDropMiddleware}
          style={{
            minHeight: 64,
            border: `1px ${dragOver ? 'solid' : 'dashed'} ${dragOver ? 'var(--accent)' : 'var(--border-strong)'}`,
            background: dragOver ? 'var(--accent-soft)' : 'var(--panel-2)',
            borderRadius: 8, padding: 8,
            display: 'flex', flexDirection: 'column', gap: 6,
            transition: 'background .12s, border-color .12s',
          }}
        >
          {router.middlewares.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, color: 'var(--muted)', fontSize: 12 }}>
              {dragOver ? 'Release to attach' : 'Drop a middleware here, or pick from below'}
            </div>
          ) : router.middlewares.map((m, i) => {
            const mw = state.middlewares.find((x) => x.name === m)
            return (
              <div key={m + i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', background: 'var(--panel)',
                border: '1px solid var(--border)', borderRadius: 6,
                minWidth: 0,
              }}>
                <span style={{ color: 'var(--faint)', cursor: 'grab', flexShrink: 0 }}><Icon name="drag" size={14} /></span>
                <span style={{ color: 'var(--muted)', fontSize: 10, width: 16, flexShrink: 0 }} className="mono">{i + 1}</span>
                <Icon name="middleware" size={13} style={{ color: mw ? 'var(--info)' : 'var(--bad)' }} />
                <span className="mono" style={{ fontSize: 12.5, color: mw ? 'var(--text)' : 'var(--bad)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{m}</span>
                {mw && <span className="pill" style={{ fontSize: 10, height: 16, padding: '0 4px' }}>{mw.type}</span>}
                <span style={{ flex: 1 }} />
                <button className="btn ghost icon sm" onClick={() => update({ middlewares: router.middlewares.filter((_, j) => j !== i) })}>
                  <Icon name="x" size={12} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Palette */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {state.middlewares.filter((m) => !router.middlewares.includes(m.name)).map((m) => (
            <div
              key={m.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/middleware', m.name); e.dataTransfer.effectAllowed = 'copy' }}
              onDoubleClick={() => update({ middlewares: [...router.middlewares, m.name] })}
              title="Drag onto the box above (or double-click)"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 8px', background: 'var(--panel)',
                border: '1px dashed var(--border-strong)', borderRadius: 5,
                fontSize: 11.5, color: 'var(--text-2)', cursor: 'grab',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <Icon name="drag" size={10} style={{ color: 'var(--faint)' }} />
              <Icon name="middleware" size={11} style={{ color: 'var(--info)' }} />
              <span className="mono">{m.name}</span>
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>{m.type}</span>
            </div>
          ))}
          {state.middlewares.length === router.middlewares.length && (
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>All defined middlewares are attached.</span>
          )}
        </div>
      </Section>

      <Section title="TLS">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'center' }}>
          <Toggle value={!!router.tls} onChange={(v) => update({ tls: v ? { certResolver: 'cloudflare' } : null })} label="Enable TLS" />
          {router.tls && (
            <Field label="Certificate resolver">
              <select className="input mono" value={router.tls.certResolver || ''} onChange={(e) => update({ tls: { ...router.tls, certResolver: e.target.value } })}>
                {COMMON_RESOLVERS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          )}
        </div>
      </Section>

      <YamlPreview snippet={snippet} />
    </EditorShell>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SERVICES
// ════════════════════════════════════════════════════════════════════════════
export function ServicesView({ state, setState, selectedId, setSelectedId, health, onSave, saving, onRecheck }) {
  const [search, setSearch] = React.useState('')
  const filtered = state.services.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))

  React.useEffect(() => {
    if (!state.services.find((s) => s.id === selectedId) && state.services.length) {
      setSelectedId(state.services[0].id)
    }
  }, [state.services, selectedId])

  const current = state.services.find((s) => s.id === selectedId)
  const update = (patch) => setState((s) => ({ ...s, services: s.services.map((x) => (x.id === selectedId ? { ...x, ...patch } : x)) }))
  const add = () => {
    const id = freshId('service', state.services)
    setState((s) => ({ ...s, services: [...s.services, { id, name: id, type: 'loadBalancer', servers: [{ url: 'http://10.1.1.1:8080' }], passHostHeader: true, sticky: null, serversTransport: null, enabled: true }] }))
    setSelectedId(id)
  }
  const remove = () => setState((s) => ({ ...s, services: s.services.filter((x) => x.id !== selectedId) }))

  // Disabling a service cascades to the routers that depend on it (a router
  // pointing at a commented-out service would break). Enabling does not cascade.
  const toggleEnabled = (svc) => {
    if (!isEnabled(svc)) {
      setState((s) => ({ ...s, services: s.services.map((x) => (x.id === svc.id ? { ...x, enabled: true } : x)) }))
      return
    }
    const deps = state.routers.filter((r) => r.service === svc.name && isEnabled(r))
    if (deps.length) {
      const ok = confirm(
        `Disable service "${svc.name}"?\n\n`
        + `${deps.length} router(s) route to it and will be disabled too — otherwise they would break:\n`
        + deps.map((r) => `· ${r.name}`).join('\n'),
      )
      if (!ok) return
    }
    const depIds = new Set(deps.map((r) => r.id))
    setState((s) => ({
      ...s,
      services: s.services.map((x) => (x.id === svc.id ? { ...x, enabled: false } : x)),
      routers: s.routers.map((r) => (depIds.has(r.id) ? { ...r, enabled: false } : r)),
    }))
  }

  // One-click fix for HTTPS upstreams: ensure an insecure transport exists and
  // attach it to the service.
  const attachInsecureTransport = (svc) => {
    setState((s) => {
      let transports = s.serversTransports
      let t = transports.find((x) => x.config && x.config.insecureSkipVerify === true)
      if (!t) {
        let name = 'insecure-https'
        let n = 2
        while (transports.find((x) => x.name === name)) name = `insecure-https-${n++}`
        t = { id: name, name, config: { insecureSkipVerify: true } }
        transports = [...transports, t]
      }
      return {
        ...s,
        serversTransports: transports,
        services: s.services.map((x) => (x.id === svc.id ? { ...x, serversTransport: t.name } : x)),
      }
    })
  }

  const countBy = (st) => state.services.filter((s) => isEnabled(s) && statusOf(health, s.name) === st).length

  return (
    <SplitPane>
      <ListPane
        title="Services"
        count={state.services.length}
        search={search} setSearch={setSearch}
        onAdd={add} addLabel="New service"
        footer={`${countBy('up')} up · ${countBy('degraded')} degraded · ${countBy('down')} down`}
      >
        {filtered.map((s) => {
          const referencing = state.routers.filter((r) => r.service === s.name).length
          return (
            <ListRow
              key={s.id}
              active={s.id === selectedId}
              dimmed={!isEnabled(s)}
              onClick={() => setSelectedId(s.id)}
              icon={<Icon name="service" size={14} />}
              label={s.name}
              sub={`${s.servers.length} server${s.servers.length === 1 ? '' : 's'}${referencing === 0 ? ' · orphan' : ` · ${referencing} router${referencing === 1 ? '' : 's'}`}`}
              status={
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {!isEnabled(s) && <OffPill />}
                  {isEnabled(s) && <HealthDot status={statusOf(health, s.name)} />}
                </span>
              }
            />
          )
        })}
      </ListPane>

      {current
        ? <ServiceEditor service={current} state={state} update={update} remove={remove}
                         health={health} onSave={onSave} saving={saving} onRecheck={onRecheck}
                         onToggleEnabled={toggleEnabled} onAttachInsecureTransport={attachInsecureTransport} />
        : <EditorEmpty icon="service" label="service" onAdd={add} />}
    </SplitPane>
  )
}

function ServiceEditor({ service, state, update, remove, health, onSave, saving, onRecheck, onToggleEnabled, onAttachInsecureTransport }) {
  const [rechecking, setRechecking] = React.useState(false)
  const disabled = !isEnabled(service)
  const referencing = state.routers.filter((r) => r.service === service.name)
  const svcHealth = healthOf(health, service.name)
  const status = statusOf(health, service.name)
  const httpsUpstream = service.servers.some((sv) => /^https:\/\//i.test(sv.url || ''))

  const issues = []
  if (disabled) issues.push({ level: 'info', message: 'This service is disabled — commented out in dynamic.yml and ignored by Traefik.' })
  if (service.servers.length === 0) issues.push({ level: 'error', message: 'Service has no backend servers.' })
  if (referencing.length === 0) issues.push({ level: 'warn', message: `No router references "${service.name}". This service is orphaned.` })
  for (const srv of service.servers) {
    if (!/^https?:\/\//.test(srv.url)) issues.push({ level: 'error', message: `Server URL "${srv.url}" is invalid.` })
  }
  if (service.serversTransport && !state.serversTransports.find((t) => t.name === service.serversTransport)) {
    issues.push({ level: 'error', message: `Server transport "${service.serversTransport}" is not defined.` })
  }
  if (httpsUpstream && !service.serversTransport) {
    issues.push({
      level: 'info',
      message: 'HTTPS upstream — if the backend uses a self-signed or hostname-mismatched certificate, attach a server transport that skips TLS verification.',
      action: { label: 'Add insecure transport', onClick: () => onAttachInsecureTransport(service) },
    })
  }
  if (!disabled && status === 'down') {
    const failed = svcHealth && svcHealth.servers && svcHealth.servers.find((x) => x.status === 'down')
    issues.push({ level: 'error', message: `Upstream is not responding${failed && failed.error ? ` (${failed.error})` : ''}.` })
  }

  const snippet = Yaml.buildServiceSnippet(service)

  const updateServer = (i, patch) => update({ servers: service.servers.map((s, j) => (i === j ? { ...s, ...patch } : s)) })
  const addServer = () => update({ servers: [...service.servers, { url: 'http://' }] })
  const removeServer = (i) => update({ servers: service.servers.filter((_, j) => j !== i) })

  const serverHealth = (i) => {
    const list = svcHealth && svcHealth.servers
    if (!list) return { status: 'unknown' }
    return list.find((x) => x.url === service.servers[i].url) || list[i] || { status: 'unknown' }
  }
  const serverTip = (h) => {
    if (h.statusCode) return `HTTP ${h.statusCode} · ${h.latencyMs}ms`
    if (h.error) return `Unreachable: ${h.error}`
    return 'Not checked yet'
  }

  const handleRecheck = async () => {
    setRechecking(true)
    try { await onRecheck(service.name, service.servers.map((s) => s.url)) } finally { setRechecking(false) }
  }

  return (
    <EditorShell
      kind="service"
      breadcrumbs={['http', 'services']}
      name={service.name}
      namePill={
        <span style={{ display: 'flex', gap: 6 }}>
          {disabled && <span className="pill">disabled</span>}
          {!disabled && <HealthDot status={status} withLabel latencyMs={svcHealth?.latencyMs} />}
        </span>
      }
      actions={
        <>
          <button className="btn ghost sm" onClick={handleRecheck} disabled={rechecking}>
            {rechecking ? <Spinner /> : <Icon name="refresh" size={13} />} Recheck
          </button>
          <EnableButton entity={service} onToggle={onToggleEnabled} />
          <button className="btn ghost sm danger" onClick={() => { if (confirm(`Delete service "${service.name}"?`)) remove() }}>
            <Icon name="trash" size={13} /> Delete
          </button>
          <button className="btn primary sm" onClick={onSave} disabled={saving}>
            {saving ? <Spinner dark /> : <><Icon name="save" size={13} /> Save changes</>}
          </button>
        </>
      }
      validationIssues={issues}
      footer={
        <>
          <span>Used by {referencing.length} router{referencing.length === 1 ? '' : 's'}{referencing.length > 0 && `: ${referencing.map((r) => r.name).join(', ')}`}</span>
          <span className="mono">http.services.{service.name}</span>
        </>
      }
    >
      <Section title="Identity">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
          <Field label="Name" htmlFor="s-name">
            <input id="s-name" className="input mono" value={service.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className="input mono" value={service.type} onChange={(e) => update({ type: e.target.value })}>
              <option value="loadBalancer">loadBalancer</option>
              <option value="weighted">weighted</option>
              <option value="mirroring">mirroring</option>
              <option value="failover">failover</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Upstream servers" hint="Where matched traffic is forwarded."
        action={<button className="btn sm" onClick={addServer}><Icon name="plus" size={12} /> Add server</button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {service.servers.map((srv, i) => {
            const sh = serverHealth(i)
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 8, alignItems: 'center',
                padding: 8, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6,
              }}>
                <span style={{ width: 22, height: 22, borderRadius: 4, display: 'grid', placeItems: 'center', background: 'var(--panel)', color: 'var(--muted)', fontSize: 11 }} className="mono">{i + 1}</span>
                <input className="input mono" value={srv.url} onChange={(e) => updateServer(i, { url: e.target.value })} placeholder="https://10.1.1.1" />
                <span title={serverTip(sh)}><HealthDot status={sh.status} /></span>
                <button className="btn ghost icon sm danger" onClick={() => removeServer(i)} disabled={service.servers.length === 1}>
                  <Icon name="trash" size={12} />
                </button>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Backend transport"
        hint="How Traefik connects to the upstream. HTTPS backends with self-signed certificates need a transport that skips TLS verification.">
        <Field label="Server transport" hint="Defined under Transports. Maps to loadBalancer.serversTransport.">
          <select className="input mono" value={service.serversTransport || ''} onChange={(e) => update({ serversTransport: e.target.value || null })}>
            <option value="">— none (default, verifies TLS) —</option>
            {state.serversTransports.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}{t.config && t.config.insecureSkipVerify ? ' (skips TLS verify)' : ''}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Options">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Toggle value={service.passHostHeader} onChange={(v) => update({ passHostHeader: v })}
                  label="Pass Host header" hint="Forward the original Host header to upstream." />
          <Toggle value={!!service.sticky} onChange={(v) => update({ sticky: v ? { cookie: {} } : null })}
                  label="Sticky sessions" hint="Pin clients to the same upstream via cookie." />
        </div>
      </Section>

      <Section title="Used by" hint={referencing.length === 0 ? 'No routers reference this service yet.' : null}>
        {referencing.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {referencing.map((r) => (
              <span key={r.id} className="pill" style={{ height: 22 }}>
                <Icon name="router" size={11} style={{ color: 'var(--accent)' }} /> {r.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ padding: 16, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12 }}>This service is orphaned — no router routes traffic to it.</span>
          </div>
        )}
      </Section>

      <YamlPreview snippet={snippet} />
    </EditorShell>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MIDDLEWARES
// ════════════════════════════════════════════════════════════════════════════
export function MiddlewaresView({ state, setState, selectedId, setSelectedId, onSave, saving }) {
  const [search, setSearch] = React.useState('')
  const filtered = state.middlewares.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.type.toLowerCase().includes(search.toLowerCase()))

  React.useEffect(() => {
    if (!state.middlewares.find((m) => m.id === selectedId) && state.middlewares.length) {
      setSelectedId(state.middlewares[0].id)
    }
  }, [state.middlewares, selectedId])

  const current = state.middlewares.find((m) => m.id === selectedId)
  const update = (patch) => setState((s) => ({ ...s, middlewares: s.middlewares.map((x) => (x.id === selectedId ? { ...x, ...patch } : x)) }))
  const add = () => {
    const id = freshId('middleware', state.middlewares)
    setState((s) => ({ ...s, middlewares: [...s.middlewares, { id, name: id, type: 'headers', config: defaultMiddlewareConfig('headers') }] }))
    setSelectedId(id)
  }
  const remove = () => setState((s) => ({ ...s, middlewares: s.middlewares.filter((x) => x.id !== selectedId) }))

  return (
    <SplitPane>
      <ListPane
        title="Middlewares"
        count={state.middlewares.length}
        search={search} setSearch={setSearch}
        onAdd={add} addLabel="New middleware"
        footer={`${state.middlewares.length} defined · ${new Set(state.middlewares.map((m) => m.type)).size} types`}
      >
        {filtered.map((m) => {
          const usage = state.routers.filter((r) => r.middlewares?.includes(m.name)).length
          return (
            <ListRow
              key={m.id}
              active={m.id === selectedId}
              onClick={() => setSelectedId(m.id)}
              icon={<Icon name="middleware" size={14} />}
              label={m.name}
              sub={`${m.type} · used by ${usage} router${usage === 1 ? '' : 's'}`}
              status={usage === 0 ? <span className="pill warn" style={{ height: 18, padding: '0 5px', fontSize: 10 }}>unused</span> : null}
            />
          )
        })}
      </ListPane>

      {current
        ? <MiddlewareEditor middleware={current} state={state} update={update} remove={remove} onSave={onSave} saving={saving} />
        : <EditorEmpty icon="middleware" label="middleware" onAdd={add} />}
    </SplitPane>
  )
}

function MiddlewareEditor({ middleware, state, update, remove, onSave, saving }) {
  const usage = state.routers.filter((r) => r.middlewares?.includes(middleware.name))
  const issues = []
  if (usage.length === 0) issues.push({ level: 'warn', message: 'This middleware is not attached to any router.' })

  const snippet = Yaml.buildMiddlewareSnippet(middleware)
  const typeMeta = MIDDLEWARE_TYPES.find((t) => t.value === middleware.type)

  return (
    <EditorShell
      kind="middleware"
      breadcrumbs={['http', 'middlewares']}
      name={middleware.name}
      namePill={<span className="pill info">{middleware.type}</span>}
      actions={
        <>
          <button className="btn ghost sm danger" onClick={() => { if (confirm(`Delete middleware "${middleware.name}"?`)) remove() }}>
            <Icon name="trash" size={13} /> Delete
          </button>
          <button className="btn primary sm" onClick={onSave} disabled={saving}>
            {saving ? <Spinner dark /> : <><Icon name="save" size={13} /> Save changes</>}
          </button>
        </>
      }
      validationIssues={issues}
      footer={
        <>
          <span>{usage.length === 0 ? 'Not in use' : `Attached to ${usage.map((r) => r.name).join(', ')}`}</span>
          <span className="mono">http.middlewares.{middleware.name}</span>
        </>
      }
    >
      <Section title="Identity">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Name" htmlFor="m-name">
            <input id="m-name" className="input mono" value={middleware.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Type" hint={typeMeta?.desc}>
            <select className="input mono" value={middleware.type} onChange={(e) => {
              const t = e.target.value
              update({ type: t, config: defaultMiddlewareConfig(t) })
            }}>
              {MIDDLEWARE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Configuration" hint="Fields adapt to the selected middleware type.">
        <MiddlewareConfigForm middleware={middleware} update={update} />
      </Section>

      <Section title="Attached to" hint={usage.length === 0 ? 'Drag this middleware onto a router from the Routers screen.' : null}>
        {usage.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {usage.map((r) => (
              <span key={r.id} className="pill">
                <Icon name="router" size={11} style={{ color: 'var(--accent)' }} /> {r.name}
              </span>
            ))}
          </div>
        ) : <span style={{ fontSize: 12, color: 'var(--faint)' }}>No routers reference this middleware.</span>}
      </Section>

      <YamlPreview snippet={snippet} />
    </EditorShell>
  )
}

function MiddlewareConfigForm({ middleware, update }) {
  const cfg = middleware.config
  const setCfg = (patch) => update({ config: { ...cfg, ...patch } })

  switch (middleware.type) {
    case 'forwardAuth':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Auth endpoint" hint="URL Traefik will call before forwarding the request.">
            <input className="input mono" value={cfg.address || ''} onChange={(e) => setCfg({ address: e.target.value })} />
          </Field>
          <Toggle value={!!cfg.trustForwardHeader} onChange={(v) => setCfg({ trustForwardHeader: v })} label="Trust X-Forwarded headers" />
          <Field label="Response headers to copy" hint="Headers from the auth response that get forwarded upstream.">
            <TagInput value={cfg.authResponseHeaders || []} onChange={(v) => setCfg({ authResponseHeaders: v })}
                      placeholder="X-User, X-Email…" suggestions={['X-authentik-username', 'X-authentik-groups', 'X-authentik-email']} />
          </Field>
        </div>
      )
    case 'headers':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Toggle value={!!cfg.browserXssFilter} onChange={(v) => setCfg({ browserXssFilter: v })} label="browserXssFilter" />
          <Toggle value={!!cfg.contentTypeNosniff} onChange={(v) => setCfg({ contentTypeNosniff: v })} label="contentTypeNosniff" />
          <Toggle value={!!cfg.frameDeny} onChange={(v) => setCfg({ frameDeny: v })} label="frameDeny" />
          <Toggle value={!!cfg.sslRedirect} onChange={(v) => setCfg({ sslRedirect: v })} label="sslRedirect" />
        </div>
      )
    case 'rateLimit':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Average (req/sec)" hint="Sustained rate after burst."><input className="input mono" type="number" value={cfg.average ?? 0} onChange={(e) => setCfg({ average: Number(e.target.value) })} /></Field>
          <Field label="Burst" hint="Max requests above average."><input className="input mono" type="number" value={cfg.burst ?? 0} onChange={(e) => setCfg({ burst: Number(e.target.value) })} /></Field>
        </div>
      )
    case 'stripPrefix':
      return (
        <Field label="Prefixes" hint="URL prefixes that get stripped before forwarding.">
          <TagInput value={cfg.prefixes || []} onChange={(v) => setCfg({ prefixes: v })} placeholder="/api, /v1…" />
        </Field>
      )
    case 'addPrefix':
      return (
        <Field label="Prefix">
          <input className="input mono" value={cfg.prefix || ''} onChange={(e) => setCfg({ prefix: e.target.value })} />
        </Field>
      )
    case 'ipAllowList':
      return (
        <Field label="Source ranges (CIDR)">
          <TagInput value={cfg.sourceRange || []} onChange={(v) => setCfg({ sourceRange: v })} placeholder="10.0.0.0/8, 192.168.0.0/16…" />
        </Field>
      )
    case 'redirectScheme':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Scheme">
            <select className="input mono" value={cfg.scheme || 'https'} onChange={(e) => setCfg({ scheme: e.target.value })}>
              <option value="https">https</option><option value="http">http</option>
            </select>
          </Field>
          <Toggle value={!!cfg.permanent} onChange={(v) => setCfg({ permanent: v })} label="301 permanent (vs 302)" />
        </div>
      )
    case 'retry':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Attempts"><input className="input mono" type="number" value={cfg.attempts ?? 0} onChange={(e) => setCfg({ attempts: Number(e.target.value) })} /></Field>
          <Field label="Initial interval"><input className="input mono" value={cfg.initialInterval || ''} onChange={(e) => setCfg({ initialInterval: e.target.value })} /></Field>
        </div>
      )
    default:
      return <div style={{ fontSize: 12, color: 'var(--muted)', padding: 12, background: 'var(--panel-2)', borderRadius: 6 }}>
        No options for this middleware type, or use the YAML preview to configure raw fields.
      </div>
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SERVER TRANSPORTS
// ════════════════════════════════════════════════════════════════════════════
export function TransportsView({ state, setState, selectedId, setSelectedId, onSave, saving, openEntity }) {
  const [search, setSearch] = React.useState('')
  const filtered = state.serversTransports.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))

  React.useEffect(() => {
    if (!state.serversTransports.find((t) => t.id === selectedId) && state.serversTransports.length) {
      setSelectedId(state.serversTransports[0].id)
    }
  }, [state.serversTransports, selectedId])

  const current = state.serversTransports.find((t) => t.id === selectedId)
  const update = (patch) => setState((s) => ({ ...s, serversTransports: s.serversTransports.map((x) => (x.id === selectedId ? { ...x, ...patch } : x)) }))
  const add = () => {
    const id = freshId('transport', state.serversTransports)
    setState((s) => ({ ...s, serversTransports: [...s.serversTransports, { id, name: id, config: { insecureSkipVerify: true } }] }))
    setSelectedId(id)
  }
  const remove = () => setState((s) => ({ ...s, serversTransports: s.serversTransports.filter((x) => x.id !== selectedId) }))

  return (
    <SplitPane>
      <ListPane
        title="Transports"
        count={state.serversTransports.length}
        search={search} setSearch={setSearch}
        onAdd={add} addLabel="New transport"
        footer={`${state.serversTransports.length} defined`}
      >
        {filtered.map((t) => {
          const usage = state.services.filter((s) => s.serversTransport === t.name).length
          return (
            <ListRow
              key={t.id}
              active={t.id === selectedId}
              onClick={() => setSelectedId(t.id)}
              icon={<Icon name="shield" size={14} />}
              label={t.name}
              sub={`${t.config && t.config.insecureSkipVerify ? 'skips TLS verify' : 'verifies TLS'} · used by ${usage} service${usage === 1 ? '' : 's'}`}
              status={usage === 0 ? <span className="pill warn" style={{ height: 18, padding: '0 5px', fontSize: 10 }}>unused</span> : null}
            />
          )
        })}
        {filtered.length === 0 && state.serversTransports.length > 0 && (
          <div className="empty" style={{ padding: 32 }}>
            <Icon name="search" size={20} style={{ color: 'var(--faint)' }} />
            <div>No transports match "{search}"</div>
          </div>
        )}
      </ListPane>

      {current
        ? <TransportEditor transport={current} state={state} update={update} remove={remove} onSave={onSave} saving={saving} openEntity={openEntity} />
        : <EditorEmpty icon="shield" label="transport" onAdd={add} />}
    </SplitPane>
  )
}

function TransportEditor({ transport, state, update, remove, onSave, saving, openEntity }) {
  const cfg = transport.config || {}
  const usage = state.services.filter((s) => s.serversTransport === transport.name)
  const issues = []
  if (usage.length === 0) issues.push({ level: 'warn', message: 'This transport is not attached to any service.' })

  const setCfg = (key, value) => {
    const next = { ...cfg }
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) delete next[key]
    else next[key] = value
    update({ config: next })
  }

  const snippet = Yaml.buildTransportSnippet(transport)

  return (
    <EditorShell
      kind="serversTransports"
      breadcrumbs={['http', 'serversTransports']}
      name={transport.name}
      namePill={cfg.insecureSkipVerify
        ? <span className="pill warn">insecure</span>
        : <span className="pill ok">verified</span>}
      actions={
        <>
          <button className="btn ghost sm danger" onClick={() => { if (confirm(`Delete transport "${transport.name}"?`)) remove() }}>
            <Icon name="trash" size={13} /> Delete
          </button>
          <button className="btn primary sm" onClick={onSave} disabled={saving}>
            {saving ? <Spinner dark /> : <><Icon name="save" size={13} /> Save changes</>}
          </button>
        </>
      }
      validationIssues={issues}
      footer={
        <>
          <span>{usage.length === 0 ? 'Not in use' : `Attached to ${usage.map((s) => s.name).join(', ')}`}</span>
          <span className="mono">http.serversTransports.{transport.name}</span>
        </>
      }
    >
      <Section title="Identity">
        <Field label="Name" hint="Referenced by a service's “Server transport” field.">
          <input className="input mono" value={transport.name} onChange={(e) => update({ name: e.target.value })} />
        </Field>
      </Section>

      <Section title="Backend TLS" hint="Controls how Traefik trusts the upstream server's TLS certificate.">
        <Toggle
          value={!!cfg.insecureSkipVerify}
          onChange={(v) => setCfg('insecureSkipVerify', v)}
          label="Skip TLS certificate verification"
          hint="Accept any certificate from the backend. Use for self-signed LAN services (Proxmox, OPNsense…). Prefer Root CAs for production." />
        <Field label="Server name (SNI)" hint="Expected certificate name. Leave empty to use the request host.">
          <input className="input mono" value={cfg.serverName || ''} placeholder="—"
                 onChange={(e) => setCfg('serverName', e.target.value)} />
        </Field>
        <Field label="Root CAs" hint="Paths to CA certificate files Traefik should trust — an alternative to skipping verification.">
          <TagInput value={cfg.rootCAs || []} onChange={(v) => setCfg('rootCAs', v)} placeholder="/certs/internal-ca.pem" />
        </Field>
      </Section>

      <Section title="Used by" hint={usage.length === 0 ? 'No services reference this transport yet.' : null}>
        {usage.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {usage.map((s) => (
              <button key={s.id} className="pill" style={{ height: 22, cursor: 'pointer' }} onClick={() => openEntity('services', s.id)}>
                <Icon name="service" size={11} style={{ color: 'var(--info)' }} /> {s.name}
              </button>
            ))}
          </div>
        ) : <span style={{ fontSize: 12, color: 'var(--faint)' }}>Set a service's “Server transport” to this one.</span>}
      </Section>

      <YamlPreview snippet={snippet} />
    </EditorShell>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ════════════════════════════════════════════════════════════════════════════
function EditorEmpty({ icon, label, onAdd }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 320 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
          <Icon name={icon} size={26} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>No {label}s yet</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Create your first {label} to get started.</div>
        </div>
        <button className="btn primary" onClick={onAdd}><Icon name="plus" size={13} /> New {label}</button>
      </div>
    </div>
  )
}

// ── Toggle (used by all editors) ──────────────────────────────────────────
function Toggle({ value, onChange, label, hint }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
      <button
        type="button" role="switch" aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          position: 'relative', width: 32, height: 18, borderRadius: 999, padding: 0,
          background: value ? 'var(--accent)' : 'var(--border-strong)',
          border: 0, transition: 'background .15s', flexShrink: 0, marginTop: 2,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          transform: value ? 'translateX(14px)' : 'none', transition: 'transform .15s',
        }} />
      </button>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{label}</span>
        {hint && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{hint}</span>}
      </span>
    </label>
  )
}
