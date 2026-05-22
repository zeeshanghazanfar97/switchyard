// Login screen — password sign-in + Authentik SSO (SSO stubbed).
import React from 'react'
import { Icon } from './icons.jsx'
import { Spinner } from './primitives.jsx'
import { api } from './api.js'

export function Login({ onLogin }) {
  const [user, setUser] = React.useState('')
  const [pw, setPw] = React.useState('')
  const [showPw, setShowPw] = React.useState(false)
  const [busy, setBusy] = React.useState(null) // 'pw' | 'sso' | null
  const [error, setError] = React.useState(null)
  const [authCfg, setAuthCfg] = React.useState(null)

  React.useEffect(() => {
    api.authConfig()
      .then(setAuthCfg)
      .catch(() => setAuthCfg({ ssoEnabled: false, ssoProvider: 'Authentik', passwordEnabled: true, ssoIssuer: null }))
  }, [])

  const provider = (authCfg && authCfg.ssoProvider) || 'Authentik'
  const ssoSubtitle = (() => {
    if (!authCfg || !authCfg.ssoIssuer) return 'Single sign-on'
    try { return new URL(authCfg.ssoIssuer).host } catch (e) { return authCfg.ssoIssuer }
  })()

  const doPassword = async (e) => {
    e?.preventDefault()
    if (!user || !pw) { setError('Username and password required.'); return }
    setError(null)
    setBusy('pw')
    try {
      const res = await api.login(user, pw)
      onLogin({ user: res.user, method: res.method })
    } catch (err) {
      setError(err.message)
      setBusy(null)
    }
  }

  const doSSO = async () => {
    setError(null)
    setBusy('sso')
    try {
      // When the OIDC flow is implemented, replace this with a full-page
      // navigation so the provider redirect works:
      //   window.location.href = '/api/auth/sso/login'
      await api.ssoLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={st.wrap}>
      {/* Background grid */}
      <div style={st.grid} aria-hidden="true" />
      <div style={st.glow} aria-hidden="true" />

      <div style={st.card} className="pop-in">
        {/* Header */}
        <div style={st.head}>
          <div style={st.brand}>
            <div style={st.logo}>
              <Icon name="helm" size={20} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>Switchyard</div>
              <div className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>traefik · dynamic.yml</div>
            </div>
          </div>
          <span className="pill">
            <span className="dot" style={{ background: authCfg ? 'var(--ok)' : 'var(--warn)' }} />
            {authCfg ? 'connected' : 'connecting…'}
          </span>
        </div>

        <div style={st.body}>
          {/* SSO first — preferred */}
          <button
            type="button"
            className="btn"
            style={{ ...st.sso, ...(busy === 'sso' ? { opacity: 0.7 } : null) }}
            onClick={doSSO}
            disabled={!!busy}
          >
            <span style={st.authentikMark} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M12 2 3 6v6c0 5 3.8 9.4 9 10 5.2-.6 9-5 9-10V6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M8 12.5l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.25, flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Continue with {provider}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{ssoSubtitle}</span>
            </span>
            {busy === 'sso'
              ? <Spinner />
              : <Icon name="arrow" size={14} style={{ color: 'var(--muted)' }} />}
          </button>

          <div style={st.divider}>
            <span style={st.dividerLine} />
            <span className="mono" style={{ color: 'var(--faint)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>or with password</span>
            <span style={st.dividerLine} />
          </div>

          <form onSubmit={doPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="login-user">Username</label>
              <div style={{ position: 'relative' }}>
                <Icon name="user" size={14} style={st.iconLeft} />
                <input
                  id="login-user"
                  className="input mono"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="admin"
                  style={{ paddingLeft: 32 }}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="login-pw">Password</label>
              <div style={{ position: 'relative' }}>
                <Icon name="lock" size={14} style={st.iconLeft} />
                <input
                  id="login-pw"
                  className="input mono"
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ paddingLeft: 32, paddingRight: 36 }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPw(!showPw)}
                  style={st.iconRightBtn}
                >
                  <Icon name={showPw ? 'eyeOff' : 'eye'} size={14} />
                </button>
              </div>
              {error && (
                <div className="field-error">
                  <Icon name="alert" size={12} /> {error}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent)' }} />
                Remember this device
              </label>
              <a href="#" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Forgot password?</a>
            </div>

            <button
              type="submit"
              className="btn primary"
              disabled={!!busy}
              style={{ height: 38, fontSize: 13.5, justifyContent: 'center' }}
            >
              {busy === 'pw' ? <Spinner dark /> : <><Icon name="arrow" size={14} /> Sign in</>}
            </button>
          </form>
        </div>

        <div style={st.foot}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="shield" size={12} /> Encrypted session
          </span>
          <span className="mono" style={{ color: 'var(--faint)' }}>{window.location.host}</span>
        </div>
      </div>

      <div style={st.fineprint}>
        Switchyard is an unofficial UI for editing Traefik dynamic configuration files. Not affiliated with Traefik Labs.
      </div>
    </div>
  )
}

const st = {
  wrap: {
    position: 'relative',
    height: '100vh', width: '100vw',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)',
    overflow: 'hidden',
  },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: `
      linear-gradient(to right, var(--border) 1px, transparent 1px),
      linear-gradient(to bottom, var(--border) 1px, transparent 1px)
    `,
    backgroundSize: '32px 32px',
    opacity: 0.4,
    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
    WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
  },
  glow: {
    position: 'absolute', top: '20%', left: '50%',
    width: 600, height: 600, transform: 'translateX(-50%)',
    background: 'radial-gradient(circle, var(--accent-soft) 0%, transparent 60%)',
    filter: 'blur(40px)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    width: 420,
    background: 'var(--panel)',
    border: '1px solid var(--border-strong)',
    borderRadius: 14,
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  },
  head: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'linear-gradient(180deg, var(--panel-2), transparent)',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12 },
  logo: {
    width: 36, height: 36, borderRadius: 8,
    display: 'grid', placeItems: 'center',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    border: '1px solid var(--accent-line)',
  },
  body: { padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 },
  sso: {
    height: 56, padding: '0 14px',
    background: 'var(--panel-2)',
    borderColor: 'var(--border-strong)',
    width: '100%', justifyContent: 'flex-start',
    gap: 12,
  },
  authentikMark: {
    width: 32, height: 32, borderRadius: 7,
    display: 'grid', placeItems: 'center',
    background: '#fd4b2d',
    color: 'white',
    flexShrink: 0,
  },
  divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' },
  dividerLine: { flex: 1, height: 1, background: 'var(--border)' },
  iconLeft: {
    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--faint)',
  },
  iconRightBtn: {
    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
    width: 26, height: 26, border: 0, background: 'transparent', color: 'var(--muted)',
    display: 'grid', placeItems: 'center', borderRadius: 5,
  },
  foot: {
    padding: '10px 16px', display: 'flex', justifyContent: 'space-between',
    gap: 8, fontSize: 11, color: 'var(--muted)',
    borderTop: '1px solid var(--border)',
    background: 'var(--panel-2)',
    whiteSpace: 'nowrap',
  },
  fineprint: {
    position: 'absolute', bottom: 20, left: 0, right: 0,
    textAlign: 'center', fontSize: 11, color: 'var(--faint)',
  },
}
