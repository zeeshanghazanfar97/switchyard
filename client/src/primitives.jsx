// Shared primitives used across all entity editors:
// - SplitPane: list (left) + detail (right) wrapper
// - ListPane: search + "+ New" + scrollable list of <ListRow>s
// - EditorShell: title bar + body + sticky footer
// - YamlPreview: collapsible read-only YAML block for current entity
// - Chips, TagInput, Spinner, etc.
import React from 'react'
import { Icon } from './icons.jsx'

export function Spinner({ dark }) {
  return (
    <span style={{
      width: 14, height: 14, borderRadius: '50%',
      border: `2px solid ${dark ? 'rgba(0,0,0,0.2)' : 'var(--border-strong)'}`,
      borderTopColor: dark ? 'rgba(0,0,0,0.85)' : 'var(--accent)',
      animation: 'spin .8s linear infinite',
      display: 'inline-block',
    }} />
  )
}

export function SplitPane({ children }) {
  return <div style={sp.wrap}>{children}</div>
}

export function ListPane({ title, count, search, setSearch, onAdd, addLabel, children, footer }) {
  return (
    <div style={sp.list}>
      <div style={sp.listHead}>
        <div style={sp.listHeadRow}>
          <div style={sp.listTitle}>
            <span>{title}</span>
            <span className="pill">{count}</span>
          </div>
          <button className="btn primary sm" onClick={onAdd}>
            <Icon name="plus" size={13} /> {addLabel || 'New'}
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
          <input
            className="input mono"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30, height: 30, fontSize: 12 }}
          />
        </div>
      </div>
      <div style={sp.listScroll}>
        {children}
      </div>
      {footer && <div style={sp.listFooter}>{footer}</div>}
    </div>
  )
}

export function ListRow({ active, onClick, icon, label, sub, status, accessory, draggable, onDragStart, onDragEnd, isDragging, dimmed }) {
  return (
    <button
      onClick={onClick}
      draggable={!!draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        ...sp.row,
        background: active ? 'var(--accent-soft)' : 'transparent',
        borderColor: active ? 'var(--accent-line)' : 'transparent',
        opacity: isDragging ? 0.4 : dimmed ? 0.5 : 1,
        cursor: draggable ? 'grab' : 'pointer',
      }}
    >
      {icon && (
        <span style={{ color: active ? 'var(--accent)' : 'var(--muted)', display: 'grid', placeItems: 'center' }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div className="mono" style={{ fontWeight: 500, color: active ? 'var(--text)' : 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12.5 }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{sub}</div>}
      </span>
      {status}
      {accessory}
    </button>
  )
}

export function EditorShell({ kind, name, namePill, breadcrumbs, actions, children, footer, validationIssues = [] }) {
  return (
    <div style={sp.editor}>
      <div style={sp.editorHead}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
          {breadcrumbs && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span style={{ color: 'var(--faint)' }}>/</span>}
                  <span>{b}</span>
                </React.Fragment>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <h2 className="mono" style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: '0 1 auto' }}>
              {name}
            </h2>
            {namePill}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>
      </div>

      {validationIssues.length > 0 && (
        <div style={sp.issues}>
          {validationIssues.map((iss, i) => {
            const tone = iss.level === 'error' ? 'bad' : iss.level === 'info' ? 'info' : 'warn'
            return (
              <div key={i} style={{
                ...sp.issue,
                color: `var(--${tone})`,
                background: `var(--${tone}-soft)`,
              }}>
                <Icon name={iss.level === 'error' ? 'alert' : 'info'} size={13} />
                <span>{iss.message}</span>
                {iss.action && (
                  <button className="btn sm ghost" onClick={iss.action.onClick} style={{ marginLeft: 'auto', color: 'inherit' }}>
                    {iss.action.label} →
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={sp.editorBody}>
        {children}
      </div>

      {footer && <div style={sp.editorFoot}>{footer}</div>}
    </div>
  )
}

export function Section({ title, hint, children, action }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            {title}
          </div>
          {hint && <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4 }}>{hint}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <div className="field-error"><Icon name="alert" size={12} /> {error}</div>
             : hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}

// Multi-tag chip input — entryPoints, authResponseHeaders, etc.
export function TagInput({ value = [], onChange, placeholder, suggestions = [] }) {
  const [draft, setDraft] = React.useState('')
  const add = (v) => {
    const t = v.trim()
    if (!t || value.includes(t)) return
    onChange([...value, t])
    setDraft('')
  }
  const remove = (i) => onChange(value.filter((_, j) => j !== i))
  return (
    <div style={tg.wrap}>
      <div style={tg.tagsRow}>
        {value.map((t, i) => (
          <span key={i} style={tg.tag} className="mono">
            {t}
            <button onClick={() => remove(i)} aria-label={`Remove ${t}`} style={tg.tagX}>
              <Icon name="x" size={10} />
            </button>
          </span>
        ))}
        <input
          className="mono"
          style={tg.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft) }
            else if (e.key === 'Backspace' && !draft && value.length) remove(value.length - 1)
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? '' : placeholder}
        />
      </div>
      {suggestions.length > 0 && (
        <div style={tg.sugRow}>
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <button key={s} className="mono" style={tg.sug} onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Collapsible read-only YAML preview pinned at editor bottom.
export function YamlPreview({ snippet, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    try { navigator.clipboard.writeText(snippet) } catch (e) { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1100)
  }
  return (
    <div style={yp.wrap}>
      <div style={yp.head} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="chevDown" size={13} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', color: 'var(--muted)' }} />
          <Icon name="yaml" size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 12 }}>YAML preview</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {snippet.split('\n').length} lines
          </span>
        </div>
        <button
          className="btn ghost sm"
          onClick={(e) => { e.stopPropagation(); copy() }}
          style={{ color: copied ? 'var(--ok)' : 'var(--muted)' }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={12} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {open && (
        <pre className="mono fade-in" style={yp.pre}>
          {colorizeYaml(snippet)}
        </pre>
      )}
    </div>
  )
}

// Naive syntax tinting — keys cyan, strings text, numbers/bool warn, comments muted.
export function colorizeYaml(src) {
  const lines = src.split('\n')
  return lines.map((line, i) => {
    const parts = []
    const indentMatch = line.match(/^(\s*)/)
    const indent = indentMatch[1]
    const rest = line.slice(indent.length)
    parts.push(<span key="i">{indent}</span>)

    // List dash
    let body = rest
    if (body.startsWith('- ')) {
      parts.push(<span key="d" style={{ color: 'var(--muted)' }}>- </span>)
      body = body.slice(2)
    } else if (body === '-') {
      parts.push(<span key="d" style={{ color: 'var(--muted)' }}>-</span>)
      body = ''
    }

    // Comment line — render muted.
    if (body.startsWith('#')) {
      parts.push(<span key="cmt" style={{ color: 'var(--faint)' }}>{body}</span>)
      return <div key={i} style={{ minHeight: '1.55em' }}>{parts}</div>
    }

    // key: value
    const kv = body.match(/^([^:#\s][^:]*?)(:)(\s*)(.*)$/)
    if (kv) {
      parts.push(<span key="k" style={{ color: 'var(--accent)' }}>{kv[1]}</span>)
      parts.push(<span key="c" style={{ color: 'var(--muted)' }}>{kv[2]}</span>)
      parts.push(<span key="s">{kv[3]}</span>)
      const v = kv[4]
      if (v) {
        if (/^"/.test(v)) parts.push(<span key="v" style={{ color: 'var(--ok)' }}>{v}</span>)
        else if (/^(true|false|null)$/.test(v)) parts.push(<span key="v" style={{ color: 'var(--warn)' }}>{v}</span>)
        else if (/^-?\d/.test(v)) parts.push(<span key="v" style={{ color: 'var(--warn)' }}>{v}</span>)
        else parts.push(<span key="v">{v}</span>)
      }
    } else {
      parts.push(<span key="b">{body}</span>)
    }

    return <div key={i} style={{ minHeight: '1.55em' }}>{parts}</div>
  })
}

// Style buckets
const sp = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    height: '100%',
    minHeight: 0,
  },
  list: {
    display: 'flex', flexDirection: 'column',
    borderRight: '1px solid var(--border)',
    background: 'var(--panel-2)',
    minHeight: 0,
  },
  listHead: {
    padding: '14px 14px 10px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  listHeadRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  listTitle: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  listScroll: { flex: 1, overflowY: 'auto', padding: '6px 8px' },
  listFooter: { padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' },
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '8px 10px',
    background: 'transparent', color: 'var(--text)',
    border: '1px solid transparent', borderRadius: 6,
    marginBottom: 2,
    transition: 'background .12s, border-color .12s',
  },
  editor: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--bg)' },
  editorHead: {
    padding: '16px 24px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    background: 'var(--bg)',
    minHeight: 70,
    gap: 16,
  },
  issues: { padding: '10px 24px 0', display: 'flex', flexDirection: 'column', gap: 6 },
  issue: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', borderRadius: 6, fontSize: 12,
    border: '1px solid currentColor',
    borderColor: 'transparent',
  },
  editorBody: { flex: 1, overflowY: 'auto', padding: '20px 24px 80px', display: 'flex', flexDirection: 'column', gap: 20 },
  editorFoot: {
    padding: '10px 24px', borderTop: '1px solid var(--border)',
    background: 'var(--panel-2)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 11.5, color: 'var(--muted)',
  },
}

const tg = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  tagsRow: {
    display: 'flex', flexWrap: 'wrap', gap: 4,
    padding: 4, minHeight: 36,
    background: 'var(--panel)',
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
  },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    height: 24, padding: '0 4px 0 8px',
    background: 'var(--accent-soft)', color: 'var(--accent)',
    borderRadius: 4, fontSize: 11.5,
  },
  tagX: {
    width: 18, height: 18, display: 'grid', placeItems: 'center',
    background: 'transparent', border: 0, color: 'inherit',
    borderRadius: 3, opacity: 0.7,
  },
  input: {
    flex: 1, minWidth: 80, height: 24, padding: '0 6px',
    background: 'transparent', border: 0, outline: 'none',
    color: 'var(--text)', fontSize: 12,
  },
  sugRow: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  sug: {
    height: 22, padding: '0 8px',
    background: 'transparent',
    border: '1px dashed var(--border-strong)',
    borderRadius: 4, color: 'var(--muted)', fontSize: 11,
  },
}

const yp = {
  wrap: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--panel-2)',
    overflow: 'hidden',
  },
  head: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', cursor: 'pointer',
    background: 'var(--panel)',
    borderBottom: '1px solid var(--border)',
  },
  pre: {
    margin: 0, padding: '14px 16px',
    fontSize: 'var(--font-mono)', lineHeight: 1.55,
    background: 'var(--panel-2)',
    color: 'var(--text-2)',
    overflowX: 'auto',
    maxHeight: 320,
  },
}
