// Top-level app: login gate, theme, sidebar nav, view router, tweaks panel.
import React from 'react'
import { Icon } from './icons.jsx'
import { Spinner } from './primitives.jsx'
import { Login } from './login.jsx'
import { RoutersView, ServicesView, MiddlewaresView, TransportsView } from './entities.jsx'
import { YamlView } from './yaml-view.jsx'
import { TweaksPanel, TweakSection, TweakRadio, useTweaks } from './tweaks-panel.jsx'
import { api } from './api.js'

const TWEAK_DEFAULTS = { density: 'comfortable', fontPair: 'default' }

const NAV_ITEMS = [
  { id: 'routers', icon: 'router', label: 'Routers' },
  { id: 'services', icon: 'service', label: 'Services' },
  { id: 'middlewares', icon: 'middleware', label: 'Middlewares' },
  { id: 'serversTransports', icon: 'shield', label: 'Transports' },
]

const COLLECTIONS = ['routers', 'services', 'middlewares', 'serversTransports']

function clone(x) {
  return x ? JSON.parse(JSON.stringify(x)) : x
}

// Counts entities that were added, removed or modified versus the last save.
function diffCount(base, cur) {
  if (!base || !cur) return 0
  let n = 0
  for (const kind of COLLECTIONS) {
    const b = base[kind] || []
    const c = cur[kind] || []
    const byId = {}
    b.forEach((x) => { byId[x.id] = x })
    const curIds = new Set(c.map((x) => x.id))
    for (const x of c) {
      if (!byId[x.id]) n++
      else if (JSON.stringify(byId[x.id]) !== JSON.stringify(x)) n++
    }
    for (const x of b) {
      if (!curIds.has(x.id)) n++
    }
  }
  return n
}

export function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS)
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem('switchyard.theme') || 'dark' } catch (e) { return 'dark' }
  })
  const [tweaksOpen, setTweaksOpen] = React.useState(false)

  const [auth, setAuth] = React.useState(null)
  const [authChecked, setAuthChecked] = React.useState(false)

  const [route, setRoute] = React.useState('routers')
  const [state, setState] = React.useState(null)
  const [baseline, setBaseline] = React.useState(null)
  const [health, setHealth] = React.useState({})
  const [loadError, setLoadError] = React.useState(null)
  const [saving, setSaving] = React.useState(false)
  const [notice, setNotice] = React.useState(null) // { ok } | { error }
  const [selection, setSelection] = React.useState({ routers: null, services: null, middlewares: null, serversTransports: null })

  // Apply theme + density + font onto <html> so the CSS vars cascade.
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('switchyard.theme', theme) } catch (e) { /* ignore */ }
  }, [theme])
  React.useEffect(() => {
    document.documentElement.dataset.density = t.density
    document.documentElement.dataset.fontPair = t.fontPair
  }, [t.density, t.fontPair])

  // Restore an existing session on load.
  React.useEffect(() => {
    let alive = true
    api.session()
      .then((s) => { if (alive && s.authenticated) setAuth({ user: s.user, method: s.method }) })
      .catch(() => {})
      .finally(() => { if (alive) setAuthChecked(true) })
    return () => { alive = false }
  }, [])

  const loadConfig = React.useCallback(() => {
    setLoadError(null)
    api.getConfig()
      .then((cfg) => { setState(cfg); setBaseline(clone(cfg)) })
      .catch((e) => setLoadError(e.message))
  }, [])

  React.useEffect(() => { if (auth) loadConfig() }, [auth, loadConfig])

  // Poll service health while signed in.
  React.useEffect(() => {
    if (!auth) return undefined
    let alive = true
    const tick = () => api.getHealth()
      .then((h) => { if (alive) setHealth(h.services || {}) })
      .catch(() => {})
    tick()
    const id = setInterval(tick, 15000)
    return () => { alive = false; clearInterval(id) }
  }, [auth])

  const unsaved = diffCount(baseline, state)

  const handleSave = React.useCallback(async () => {
    if (!state) return
    setSaving(true)
    setNotice(null)
    const snap = {
      routers: state.routers,
      services: state.services,
      middlewares: state.middlewares,
      serversTransports: state.serversTransports,
    }
    try {
      const resp = await api.saveConfig(snap)
      setState((s) => ({ ...s, meta: resp.meta }))
      setBaseline({ ...clone(snap), meta: resp.meta })
      setNotice({ ok: true })
      api.getHealth().then((h) => setHealth(h.services || {})).catch(() => {})
    } catch (e) {
      setNotice({ error: e.message })
    } finally {
      setSaving(false)
      setTimeout(() => setNotice(null), 3600)
    }
  }, [state])

  const openEntity = React.useCallback((kind, id) => {
    setSelection((s) => ({ ...s, [kind]: id }))
    setRoute(kind)
  }, [])

  const replaceConfig = React.useCallback((cfg) => {
    setState((s) => ({
      ...s,
      routers: cfg.routers,
      services: cfg.services,
      middlewares: cfg.middlewares,
      serversTransports: cfg.serversTransports,
    }))
  }, [])

  const recheck = React.useCallback(async (name, urls) => {
    try {
      const h = await api.recheck(name, urls)
      setHealth((prev) => ({ ...prev, ...(h.services || {}) }))
    } catch (e) { /* ignore */ }
  }, [])

  const handleLogout = async () => {
    try { await api.logout() } catch (e) { /* ignore */ }
    setAuth(null)
    setState(null)
    setBaseline(null)
    setHealth({})
    setLoadError(null)
  }

  const selectFor = (kind) => (v) => setSelection((s) => ({ ...s, [kind]: v }))

  // ── render ────────────────────────────────────────────────────────────────
  if (!authChecked) return <Splash />

  if (!auth) return <Login onLogin={setAuth} />

  const fileName = (state?.meta?.file || 'dynamic.yml').split('/').pop()

  let mainContent
  if (loadError && !state) {
    mainContent = (
      <CenterCard
        title="Couldn't load configuration"
        message={loadError}
        action={<button className="btn primary" onClick={loadConfig}><Icon name="refresh" size={13} /> Retry</button>}
      />
    )
  } else if (!state) {
    mainContent = <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}><Spinner /></div>
  } else if (route === 'routers') {
    mainContent = (
      <RoutersView
        state={state} setState={setState} health={health}
        selectedId={selection.routers} setSelectedId={selectFor('routers')}
        onSave={handleSave} saving={saving} openEntity={openEntity}
      />
    )
  } else if (route === 'services') {
    mainContent = (
      <ServicesView
        state={state} setState={setState} health={health}
        selectedId={selection.services} setSelectedId={selectFor('services')}
        onSave={handleSave} saving={saving} onRecheck={recheck}
      />
    )
  } else if (route === 'middlewares') {
    mainContent = (
      <MiddlewaresView
        state={state} setState={setState}
        selectedId={selection.middlewares} setSelectedId={selectFor('middlewares')}
        onSave={handleSave} saving={saving}
      />
    )
  } else if (route === 'serversTransports') {
    mainContent = (
      <TransportsView
        state={state} setState={setState}
        selectedId={selection.serversTransports} setSelectedId={selectFor('serversTransports')}
        onSave={handleSave} saving={saving} openEntity={openEntity}
      />
    )
  } else if (route === 'yaml') {
    mainContent = <YamlView state={state} onReplaceConfig={replaceConfig} />
  }

  return (
    <div style={app.shell}>
      {/* Sidebar */}
      <aside style={app.sidebar}>
        <div style={app.brand}>
          <div style={app.brandLogo}><Icon name="helm" size={18} /></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>Switchyard</span>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>traefik · dynamic config</span>
          </div>
        </div>

        <div style={app.navSection}>
          <div style={app.navLabel}>HTTP</div>
          {NAV_ITEMS.map((n) => (
            <NavButton key={n.id} item={n}
              active={route === n.id}
              count={state ? state[n.id]?.length : null}
              onClick={() => setRoute(n.id)}
            />
          ))}
        </div>

        <div style={app.navSection}>
          <div style={app.navLabel}>SOURCE</div>
          <NavButton item={{ id: 'yaml', icon: 'yaml', label: 'Raw YAML' }} active={route === 'yaml'} onClick={() => setRoute('yaml')} />
        </div>

        <div style={{ flex: 1 }} />

        {/* File status card */}
        <div style={app.fileCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Icon name="yaml" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
              {fileName}
            </span>
            {unsaved > 0 && <span className="pill warn" style={{ height: 16, padding: '0 5px', fontSize: 10 }}>{unsaved}</span>}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>
            {unsaved === 0 ? 'Synced with disk' : `${unsaved} unsaved change${unsaved === 1 ? '' : 's'}`}
          </div>
          <button className="btn primary sm" style={{ width: '100%', justifyContent: 'center', height: 28 }}
                  onClick={handleSave} disabled={saving || unsaved === 0}>
            {saving ? <Spinner dark /> : <><Icon name="save" size={12} /> Apply changes</>}
          </button>
        </div>

        {/* User row */}
        <div style={app.userRow}>
          <div style={app.avatar}>{(auth.user || '?').charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{auth.user}</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{auth.method === 'authentik' ? 'SSO · Authentik' : 'Local · password'}</div>
          </div>
          <button className="btn ghost icon sm" title="Tweaks" onClick={() => setTweaksOpen((o) => !o)}>
            <Icon name="settings" size={13} />
          </button>
          <button className="btn ghost icon sm" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={13} />
          </button>
          <button className="btn ghost icon sm" title="Sign out" onClick={handleLogout}>
            <Icon name="logout" size={13} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={app.main}>
        {mainContent}
      </main>

      {/* Toast */}
      {notice && (
        <div style={app.toast} className="pop-in">
          {notice.error ? (
            <>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bad-soft)', color: 'var(--bad)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="alert" size={13} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Couldn't apply changes</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }} className="mono">{notice.error}</div>
              </div>
            </>
          ) : (
            <>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--ok-soft)', color: 'var(--ok)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="check" size={13} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Configuration applied</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }} className="mono">Written to {fileName} · traefik will hot-reload</div>
              </div>
            </>
          )}
        </div>
      )}

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} title="Tweaks">
        <TweakSection label="Layout">
          <TweakRadio label="Density" value={t.density} options={['compact', 'comfortable']}
                      onChange={(v) => setTweak('density', v)} />
        </TweakSection>
        <TweakSection label="Type">
          <TweakRadio label="Font pair" value={t.fontPair}
                      options={[{ value: 'default', label: 'Default' }, { value: 'mono-headings', label: 'Mono-first' }]}
                      onChange={(v) => setTweak('fontPair', v)} />
        </TweakSection>
        <TweakSection label="Theme">
          <TweakRadio label="Mode" value={theme} options={['dark', 'light']} onChange={setTheme} />
        </TweakSection>
      </TweaksPanel>
    </div>
  )
}

function NavButton({ item, active, count, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      width: '100%', padding: '7px 10px',
      background: active ? 'var(--accent-soft)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text-2)',
      border: 0, borderRadius: 6,
      fontSize: 13, fontWeight: 500,
      cursor: 'pointer', textAlign: 'left',
      transition: 'background .12s, color .12s',
      position: 'relative',
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--hover)' }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      {active && <span style={{ position: 'absolute', left: -10, top: 6, bottom: 6, width: 2, background: 'var(--accent)', borderRadius: 2 }} />}
      <Icon name={item.icon} size={15} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {count != null && (
        <span className="mono" style={{ fontSize: 10.5, color: active ? 'var(--accent)' : 'var(--muted)' }}>
          {count}
        </span>
      )}
    </button>
  )
}

function Splash() {
  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)' }}>
          <Icon name="helm" size={22} />
        </div>
        <Spinner />
      </div>
    </div>
  )
}

function CenterCard({ title, message, action }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 400, padding: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--bad-soft)', color: 'var(--bad)', border: '1px solid var(--border)' }}>
          <Icon name="alert" size={26} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{message}</div>
        </div>
        {action}
      </div>
    </div>
  )
}

const app = {
  shell: {
    display: 'grid',
    gridTemplateColumns: '232px 1fr',
    height: '100vh',
    background: 'var(--bg)',
  },
  sidebar: {
    display: 'flex', flexDirection: 'column',
    background: 'var(--panel)',
    borderRight: '1px solid var(--border)',
    padding: '16px 12px',
    gap: 16,
    minHeight: 0,
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0 8px 12px',
    borderBottom: '1px solid var(--border)',
    marginBottom: 4,
  },
  brandLogo: {
    width: 30, height: 30, borderRadius: 7,
    display: 'grid', placeItems: 'center',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    border: '1px solid var(--accent-line)',
  },
  navSection: { display: 'flex', flexDirection: 'column', gap: 2 },
  navLabel: {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--faint)', padding: '0 10px 6px',
  },
  fileCard: {
    padding: 12, borderRadius: 8,
    background: 'var(--panel-2)',
    border: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 4px 2px',
    borderTop: '1px solid var(--border)',
    marginTop: 4,
  },
  avatar: {
    width: 28, height: 28, borderRadius: '50%',
    display: 'grid', placeItems: 'center',
    background: 'linear-gradient(135deg, var(--accent), var(--info))',
    color: 'white', fontSize: 12, fontWeight: 600,
    flexShrink: 0,
  },
  main: {
    display: 'flex', flexDirection: 'column',
    minHeight: 0, overflow: 'hidden',
  },
  toast: {
    position: 'fixed', bottom: 24, right: 24,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px',
    maxWidth: 380,
    background: 'var(--panel)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-lg)',
    zIndex: 100,
  },
}
