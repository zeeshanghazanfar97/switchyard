// Config routes: read/write the Traefik dynamic file and parse pasted YAML.
const express = require('express')
const { requireAuth } = require('../auth')
const store = require('../yamlStore')
const health = require('../health')

const router = express.Router()

// Remembered in-process so the UI can show who last applied a change.
let lastSavedBy = null

router.use(requireAuth)

router.get('/', async (req, res) => {
  try {
    const state = await store.read()
    if (lastSavedBy) state.meta.lastModifiedBy = lastSavedBy
    res.json(state)
  } catch (e) {
    res.status(500).json({ error: 'Failed to read configuration: ' + e.message })
  }
})

router.put('/', async (req, res) => {
  const { routers, services, middlewares, serversTransports } = req.body || {}
  if (![routers, services, middlewares, serversTransports].every(Array.isArray)) {
    return res.status(400).json({
      error: 'Payload must include routers, services, middlewares and serversTransports arrays.',
    })
  }
  try {
    await store.write({ routers, services, middlewares, serversTransports })
    lastSavedBy = req.session.user.name
    const state = await store.read()
    state.meta.lastModifiedBy = lastSavedBy
    // The deployed config changed — refresh health in the background.
    health.checkAll().catch(() => {})
    res.json(state)
  } catch (e) {
    res.status(500).json({ error: 'Failed to write configuration: ' + e.message })
  }
})

// Parse raw YAML text into editor state (used by Import and raw editing).
// Recovers disabled entries from the fenced comment block; writes nothing.
router.post('/parse', (req, res) => {
  const text = req.body && req.body.yaml
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Expected a JSON body of the form { "yaml": "..." }.' })
  }
  try {
    res.json(store.parseConfig(text))
  } catch (e) {
    res.status(422).json({ error: 'YAML parse error: ' + e.message })
  }
})

module.exports = router
