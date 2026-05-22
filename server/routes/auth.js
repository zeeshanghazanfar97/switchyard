// Authentication routes: password login, session, logout, and the SSO stub.
const express = require('express')
const config = require('../config')
const { checkCredentials } = require('../auth')

const router = express.Router()

// Current session state — polled by the client on load.
router.get('/session', (req, res) => {
  const user = req.session && req.session.user
  res.json({
    authenticated: !!user,
    user: user ? user.name : null,
    method: user ? user.method : null,
  })
})

// What sign-in methods are available — drives the login screen.
router.get('/config', (req, res) => {
  res.json({
    passwordEnabled: !!config.admin.password,
    ssoEnabled: config.sso.enabled,
    ssoProvider: config.sso.providerName,
    ssoIssuer: config.sso.issuerUrl || null,
  })
})

router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!config.admin.password) {
    return res.status(503).json({
      error: 'Password login is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in .env.',
    })
  }
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' })
  }
  if (!checkCredentials(username, password)) {
    return res.status(401).json({ error: 'Invalid username or password.' })
  }
  req.session.user = { name: username, method: 'password' }
  res.json({ authenticated: true, user: username, method: 'password' })
})

router.post('/logout', (req, res) => {
  req.session = null
  res.json({ authenticated: false })
})

// ── OpenID Connect SSO ───────────────────────────────────────────────────────
// STUB. The redirect/callback flow is intentionally not implemented in this
// build. To complete it:
//   1. /sso/login  — build the authorization URL from config.sso
//      ({issuerUrl, clientId, redirectUri, scopes}), generate a `state` value
//      (and a PKCE verifier), stash them on req.session, then 302 the browser
//      to the provider.
//   2. /sso/callback — verify `state`, exchange `code` at the issuer's token
//      endpoint, validate the id_token (signature, iss, aud, exp), set
//      req.session.user = { name, method: 'authentik' }, and redirect to '/'.
// Using the `openid-client` package handles discovery + token validation.
router.get('/sso/login', (req, res) => {
  if (!config.sso.enabled) {
    return res.status(501).json({
      error: `${config.sso.providerName} SSO is not configured. Set SSO_ENABLED=true and the OIDC_* variables in .env.`,
    })
  }
  return res.status(501).json({
    error: `${config.sso.providerName} SSO sign-in is not yet implemented in this build.`,
  })
})

router.get('/sso/callback', (req, res) => {
  res.status(501).json({ error: 'SSO callback is not yet implemented.' })
})

module.exports = router
