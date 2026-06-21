/**
 * Maidan Play — Stateless JWT session middleware
 * JWT in httpOnly SameSite=Lax cookie — survives server restarts.
 */
const jwt = require('jsonwebtoken');

const SECRET = () => process.env.SESSION_SECRET || 'dev-secret';
const TTL = () => process.env.TOKEN_TTL || '7d';
const COOKIE = 'session';

function issueToken(user) {
  return jwt.sign(
    { username: user.username, displayName: user.displayName, role: user.role },
    SECRET(),
    { expiresIn: TTL() }
  );
}

function authenticate(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, SECRET());
    next();
  } catch (err) {
    res.clearCookie(COOKIE);
    return res.status(401).json({ ok: false, error: 'Session expired' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
    if (req.user.role !== role) {
      // Cross-role bounce for HTML page requests
      if (req.accepts('html')) {
        return res.redirect(req.user.role === 'admin' ? '/admin' : '/capture');
      }
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    next();
  };
}

function setCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearCookie(res) {
  res.clearCookie(COOKIE);
}

module.exports = { issueToken, authenticate, requireRole, setCookie, clearCookie };
