// Switchyard server — API + static client.
const path = require('path')
const fs = require('fs')
const express = require('express')
const cookieSession = require('cookie-session')
const config = require('./config')
const health = require('./health')

const app = express()

// Trust the reverse proxy (Traefik) so Secure cookies and protocol detection
// work when Switchyard runs behind TLS termination.
app.set('trust proxy', 1)
app.use(express.json({ limit: '4mb' }))
app.use(cookieSession({
  name: 'switchyard.sid',
  keys: [config.sessionSecret],
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'lax',
  secure: config.nodeEnv === 'production',
}))

app.use('/api/auth', require('./routes/auth'))
app.use('/api/config', require('./routes/config'))
app.use('/api/health', require('./routes/health'))
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }))

// Serve the built client (production). In development the client is served by
// the Vite dev server, which proxies /api here.
const clientDist = path.join(__dirname, '..', 'client', 'dist')
const indexHtml = path.join(clientDist, 'index.html')
if (fs.existsSync(indexHtml)) {
  app.use(express.static(clientDist))
  app.get('*', (req, res) => res.sendFile(indexHtml))
} else {
  app.get('*', (req, res) => res.status(503).type('html').send(
    '<body style="font-family:system-ui;background:#0a0e14;color:#e6edf3;padding:48px;line-height:1.6">'
    + '<h1>Switchyard</h1><p>The client build was not found.</p>'
    + '<p>Development: run <code>npm run dev</code> and open the Vite dev server.</p>'
    + '<p>Production: run <code>npm run build</code>, then <code>npm start</code>.</p></body>',
  ))
}

app.listen(config.port, () => {
  console.log(`Switchyard listening on http://localhost:${config.port}`)
  console.log(`Editing Traefik dynamic config: ${config.dynamicFile}`)
  if (!config.admin.password) {
    console.warn('WARNING: ADMIN_PASSWORD is not set — password login is disabled.')
  }
  health.start()
})
