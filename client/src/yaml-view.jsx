// Raw YAML view — the whole config as one document, with import/export and
// round-trip raw editing through the server's YAML parser.
import React from 'react'
import { Icon } from './icons.jsx'
import { Yaml, timeAgo } from './yaml-utils.js'
import { colorizeYaml, Spinner } from './primitives.jsx'
import { api } from './api.js'

export function YamlView({ state, onReplaceConfig }) {
  const yamlText = Yaml.buildFullConfig(state)
  const [copied, setCopied] = React.useState(false)
  const [wrapLines, setWrapLines] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const [error, setError] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const fileRef = React.useRef(null)
  const lines = yamlText.split('\n')

  const copy = () => {
    try { navigator.clipboard.writeText(yamlText) } catch (e) { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const download = () => {
    const blob = new Blob([yamlText], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dynamic.yml'
    a.click()
    URL.revokeObjectURL(url)
  }

  const startEdit = () => { setDraft(yamlText); setError(null); setEditing(true) }
  const cancelEdit = () => { setEditing(false); setError(null) }

  // Parse the edited text on the server and load the result into the editor.
  // It still has to be applied with "Apply changes" to reach disk.
  const applyEdit = async () => {
    setBusy(true)
    setError(null)
    try {
      const parsed = await api.parseYaml(draft)
      onReplaceConfig(parsed)
      setEditing(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onImport = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const text = await file.text()
      const parsed = await api.parseYaml(text)
      onReplaceConfig(parsed)
    } catch (err) {
      setError('Import failed: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div style={yv.head}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Source</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <h2 className="mono" style={{ margin: 0, fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state.meta?.file || 'dynamic.yml'}</h2>
            <span className={`pill ${editing ? 'warn' : 'ok'}`}><span className="dot" /> {editing ? 'editing' : 'valid'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" onClick={() => setWrapLines(!wrapLines)}>
            {wrapLines ? 'No wrap' : 'Wrap'}
          </button>
          <input ref={fileRef} type="file" accept=".yml,.yaml,text/yaml" onChange={onImport} style={{ display: 'none' }} />
          <button className="btn ghost sm" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy || editing}>
            <Icon name="upload" size={13} /> Import
          </button>
          <button className="btn ghost sm" onClick={download}><Icon name="download" size={13} /> Export</button>
          <button className="btn sm" onClick={copy} style={{ color: copied ? 'var(--ok)' : null }}>
            <Icon name={copied ? 'check' : 'copy'} size={13} /> {copied ? 'Copied' : 'Copy'}
          </button>
          {editing ? (
            <>
              <button className="btn ghost sm" onClick={cancelEdit} disabled={busy}>Cancel</button>
              <button className="btn primary sm" onClick={applyEdit} disabled={busy}>
                {busy ? <Spinner dark /> : <><Icon name="save" size={13} /> Apply &amp; format</>}
              </button>
            </>
          ) : (
            <button className="btn primary sm" onClick={startEdit}>
              <Icon name="edit" size={13} /> Edit raw
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div style={yv.stats}>
        <Stat icon="router" color="var(--accent)" label="routers" value={state.routers.length} />
        <Stat icon="service" color="var(--info)" label="services" value={state.services.length} />
        <Stat icon="middleware" color="var(--warn)" label="middlewares" value={state.middlewares.length} />
        <span style={{ flex: 1 }} />
        <Stat icon="globe" color="var(--ok)" label="entrypoints" value={[...new Set(state.routers.flatMap((r) => r.entryPoints))].length} />
        <Stat icon="server" color="var(--muted)" label="upstreams" value={state.services.reduce((n, s) => n + s.servers.length, 0)} />
        <Stat icon="history" color="var(--faint)" label="last save" value={timeAgo(state.meta?.lastModified)} />
      </div>

      {error && (
        <div style={yv.error}>
          <Icon name="alert" size={13} />
          <span style={{ flex: 1, minWidth: 0 }}>{error}</span>
          <button className="btn ghost sm" style={{ color: 'inherit' }} onClick={() => setError(null)}>
            <Icon name="x" size={12} />
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--panel-2)' }}>
        {editing ? (
          <textarea
            className="mono"
            value={draft}
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            style={yv.textarea}
          />
        ) : (
          <div style={{ display: 'flex', minWidth: 'fit-content' }}>
            <div style={yv.gutter}>
              {lines.map((_, i) => <div key={i} className="mono" style={{ height: '1.55em' }}>{i + 1}</div>)}
            </div>
            <pre className="mono" style={{
              ...yv.pre,
              whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
              wordBreak: wrapLines ? 'break-word' : 'normal',
            }}>
              {colorizeYaml(yamlText)}
            </pre>
          </div>
        )}
      </div>

      <div style={yv.foot}>
        <span><Icon name="info" size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Editing here updates the form editor. Apply changes to write the file to disk.</span>
        <span className="mono" style={{ color: 'var(--faint)' }}>
          {(editing ? draft : yamlText).split('\n').length} lines · {new Blob([editing ? draft : yamlText]).size} bytes · UTF-8 · LF
        </span>
      </div>
    </div>
  )
}

function Stat({ icon, color, label, value }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
      <Icon name={icon} size={13} style={{ color }} />
      <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{value}</span>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
    </span>
  )
}

const yv = {
  head: {
    padding: '16px 24px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    background: 'var(--bg)',
    gap: 16,
  },
  stats: {
    display: 'flex', alignItems: 'center', gap: 18,
    padding: '10px 24px',
    background: 'var(--panel-2)',
    borderBottom: '1px solid var(--border)',
  },
  error: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 24px',
    background: 'var(--bad-soft)', color: 'var(--bad)',
    fontSize: 12,
    borderBottom: '1px solid var(--border)',
  },
  gutter: {
    padding: '16px 14px', textAlign: 'right',
    background: 'var(--panel)',
    borderRight: '1px solid var(--border)',
    color: 'var(--faint)', fontSize: 'var(--font-mono)',
    userSelect: 'none', flexShrink: 0,
    minWidth: 56,
  },
  pre: {
    margin: 0, padding: '16px 20px',
    fontSize: 'var(--font-mono)', lineHeight: 1.55,
    color: 'var(--text-2)', flex: 1,
  },
  textarea: {
    width: '100%', height: '100%', minHeight: '100%',
    boxSizing: 'border-box', resize: 'none',
    border: 0, outline: 'none',
    background: 'var(--panel-2)', color: 'var(--text)',
    padding: '16px 20px',
    fontSize: 'var(--font-mono)', lineHeight: 1.55,
  },
  foot: {
    padding: '8px 24px', borderTop: '1px solid var(--border)',
    background: 'var(--panel-2)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 11, color: 'var(--muted)',
  },
}
