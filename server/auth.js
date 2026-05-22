// Password authentication helpers and the route guard.
const crypto = require('crypto')
const config = require('./config')

// Constant-time string comparison so a wrong password can't be probed by
// measuring response time.
function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a), 'utf8')
  const bb = Buffer.from(String(b), 'utf8')
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba)
    return false
  }
  return crypto.timingSafeEqual(ba, bb)
}

// Checks credentials against ADMIN_USERNAME / ADMIN_PASSWORD. Both fields are
// always evaluated so timing doesn't reveal which one was wrong.
function checkCredentials(username, password) {
  if (!config.admin.password) return false
  const userOk = timingSafeEqualStr(username || '', config.admin.username)
  const passOk = timingSafeEqualStr(password || '', config.admin.password)
  return userOk && passOk
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next()
  return res.status(401).json({ error: 'Not authenticated.' })
}

module.exports = { checkCredentials, requireAuth }
