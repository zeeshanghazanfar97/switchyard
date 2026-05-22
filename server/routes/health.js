// Health routes: read cached service health and trigger on-demand re-checks.
const express = require('express')
const { requireAuth } = require('../auth')
const health = require('../health')

const router = express.Router()

router.use(requireAuth)

// Latest cached health for every service.
router.get('/', (req, res) => {
  res.json(health.snapshot())
})

// Re-check on demand. With { name, urls } re-checks one service (optionally
// against caller-supplied URLs); with an empty body re-checks everything.
router.post('/recheck', async (req, res) => {
  const { name, urls } = req.body || {}
  try {
    if (name) {
      const result = await health.checkOne(name, urls)
      res.json({ services: { [name]: result }, checkedAt: result.checkedAt })
    } else {
      const services = await health.checkAll()
      res.json({ services, checkedAt: new Date().toISOString() })
    }
  } catch (e) {
    res.status(500).json({ error: 'Health check failed: ' + e.message })
  }
})

module.exports = router
