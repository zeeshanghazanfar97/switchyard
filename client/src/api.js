// Thin client for the Switchyard backend API. All calls are same-origin so
// the session cookie rides along automatically.

async function request(method, path, body) {
  const opts = { method, headers: {}, credentials: 'same-origin' }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch('/api' + path, opts)
  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await res.json() : await res.text()
  if (!res.ok) {
    const message = data && data.error ? data.error : res.statusText || 'Request failed'
    throw new Error(message)
  }
  return data
}

export const api = {
  // Auth
  session: () => request('GET', '/auth/session'),
  authConfig: () => request('GET', '/auth/config'),
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  ssoLogin: () => request('GET', '/auth/sso/login'),

  // Config
  getConfig: () => request('GET', '/config'),
  saveConfig: (state) => request('PUT', '/config', state),
  parseYaml: (yaml) => request('POST', '/config/parse', { yaml }),

  // Health
  getHealth: () => request('GET', '/health'),
  recheck: (name, urls) => request('POST', '/health/recheck', name ? { name, urls } : {}),
}
