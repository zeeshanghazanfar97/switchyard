// Loads and normalises configuration from environment variables (.env).
const path = require('path')
require('dotenv').config()

function bool(value, fallback = false) {
  if (value == null || value === '') return fallback
  return /^(1|true|yes|on)$/i.test(String(value).trim())
}

function int(value, fallback) {
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

const nodeEnv = process.env.NODE_ENV || 'development'

const config = {
  port: int(process.env.PORT, 8080),
  nodeEnv,
  sessionSecret: process.env.SESSION_SECRET || 'switchyard-dev-insecure-secret',

  // Send the session cookie over HTTPS only. Defaults to on in production;
  // set SECURE_COOKIES=false when Switchyard is served over plain HTTP.
  secureCookies: bool(process.env.SECURE_COOKIES, nodeEnv === 'production'),

  // Absolute path to the Traefik dynamic config file Switchyard edits.
  dynamicFile: path.resolve(process.env.TRAEFIK_DYNAMIC_FILE || './data/dynamic.yml'),

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || '',
  },

  sso: {
    enabled: bool(process.env.SSO_ENABLED, false),
    providerName: process.env.OIDC_PROVIDER_NAME || 'Authentik',
    issuerUrl: process.env.OIDC_ISSUER_URL || '',
    clientId: process.env.OIDC_CLIENT_ID || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET || '',
    redirectUri: process.env.OIDC_REDIRECT_URI || '',
    scopes: process.env.OIDC_SCOPES || 'openid profile email',
  },

  health: {
    intervalMs: int(process.env.HEALTH_CHECK_INTERVAL, 30000),
    timeoutMs: int(process.env.HEALTH_CHECK_TIMEOUT, 5000),
    // A health check measures reachability, not certificate trust. Defaults to
    // accepting self-signed / untrusted certs on HTTPS upstreams.
    insecureTls: bool(process.env.HEALTH_CHECK_INSECURE_TLS, true),
  },
}

module.exports = config
